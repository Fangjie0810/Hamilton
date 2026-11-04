"""Paper-design audit only. This does not import or modify the live game.

Checks mainline plan availability and five authored example trajectories.
Numbers are a first balancing proposal, not play-tested production rules.
"""
from copy import deepcopy
from itertools import combinations, product
from pathlib import Path
import json

BASE = dict(M=42, I=12, W=0, R=20, V=10, P=40, U=70, O=40)
# M/I already include the mandatory newspaper and street-argument rewards.
CHOICES = {
    "arrival": {
        "observe": dict(M=-5, R=5),
        "question": dict(I=2, R=3),
        "declare": dict(M=10, I=5, V=5),
    },
    "laurens": {
        "stability": dict(M=-3, R=2),
        "representation": dict(I=4),
        "liberty": dict(M=5, I=4),
    },
    "lafayette": {
        "negotiate": dict(M=-2, R=2),
        "allies": dict(I=5, M=2),
        "independence": dict(M=8, I=3, V=2),
    },
    "mulligan": {
        "print": dict(I=4, M=1),
        "supplies": dict(I=3, R=3),
        "rally": dict(M=7, I=3, V=3),
    },
    "debate": {
        "facts": dict(I=8, R=8),
        "principle": dict(I=10, M=2),
        "mobilize": dict(I=12, M=4),
        "challenge": dict(I=10, M=8, V=10),
    },
    "office": {
        "accept": dict(W=15, M=-5),
        "negotiate": dict(W=8, M=5),
        "front": dict(M=10),
    },
    "crisis": {
        "report": dict(W=10, R=5, O=-10),
        "public": dict(W=3, I=6, R=3, O=-10),
        "conceal": dict(W=5, M=3, P=-15, O=10),
    },
}
ASSETS = {
    "supply": dict(P=15),
    "recon": dict(P=10, O=10),
    "medical": dict(U=10),
    "liaison": dict(U=10),
    "vanguard": dict(O=20, U=-10),
}


def add(state, effects):
    for key, delta in effects.items():
        state[key] = max(0, min(100, state[key] + delta))


def assemble(path, assets):
    state = deepcopy(BASE)
    state.update(flags={}, assets=list(assets))
    # Apply slots before the discrepancy response, as in the proposed story.
    for node in list(CHOICES)[:-1]:
        add(state, CHOICES[node][path[node]])
    for asset in assets:
        add(state, ASSETS[asset])
    add(state, CHOICES["crisis"][path["crisis"]])
    state["flags"]["unresolved_report"] = path["crisis"] == "conceal"
    return state


def plans(state):
    a = state["assets"]
    result = ["rescue"]  # A basic rescue/relay assignment is always available.
    if "liaison" in a and (state["W"] >= 18 or state["R"] >= 35):
        result.append("joint")
    if {"supply", "recon"}.issubset(a) and (state["W"] >= 8 or state["I"] >= 35):
        result.append("staff")
    if "vanguard" in a and state["M"] >= 60:
        result.append("solo")
    return result


def resolve(state):
    """Dispatch on the player's committed objective, never on max attributes."""
    f, a, objective = state["flags"], state["assets"], state["objective"]
    if objective == "rescue":
        success = f.get("civilians_out") and f.get("wounded_out") and state["U"] >= 40
        return "E2" if success else "E5"
    if objective == "joint":
        success = ("liaison" in a and f.get("signal") and f.get("flank_held")
                   and state["P"] + state["U"] >= 120 and state["U"] >= 50)
        return "E1" if success else "E5"
    if objective == "staff":
        success = ({"supply", "recon"}.issubset(a) and f.get("verified")
                   and not f.get("unresolved_report") and f.get("supply_route_held")
                   and state["P"] >= 60)
        return "E3" if success else "E5"
    if objective == "solo":
        success = f.get("breach") and state["O"] >= 60 and state["U"] >= 25
        return "E4" if success else "E5"
    raise ValueError(objective)


EXAMPLES = [
    dict(id="joint", expected="E1", objective="joint",
         path=["question", "representation", "allies", "supplies", "facts", "negotiate", "report"],
         assets=["supply", "recon", "liaison"],
         steps=[("use_recon", dict(O=10), {}),
                ("wait_for_signal", dict(O=-10, U=5), dict(signal=True)),
                ("hold_flank_and_advance", dict(O=-10, U=-10), dict(flank_held=True))]),
    dict(id="rescue", expected="E2", objective="rescue",
         path=["question", "liberty", "allies", "print", "mobilize", "negotiate", "public"],
         assets=["supply", "medical", "liaison"],
         steps=[("civilian_guides", dict(P=5), {}),
                ("escort_civilians", dict(U=-10, O=-15), dict(civilians_out=True)),
                ("escort_wounded", dict(U=-10, O=-15), dict(wounded_out=True))]),
    dict(id="staff", expected="E3", objective="staff",
         path=["observe", "representation", "negotiate", "supplies", "facts", "accept", "report"],
         assets=["supply", "recon", "medical"],
         steps=[("use_recon", dict(O=10), {}),
                ("verify_terms", dict(O=-10), dict(verified=True)),
                ("hold_supply_and_send_envoy", dict(U=-5), dict(supply_route_held=True))]),
    dict(id="solo", expected="E4", objective="solo",
         path=["declare", "liberty", "independence", "rally", "challenge", "front", "report"],
         assets=["supply", "recon", "vanguard"],
         steps=[("use_recon", dict(O=10), {}),
                ("commit_own_reserve", dict(U=-10, O=10), dict(independent_commitment=True)),
                ("force_breach", dict(U=-15, O=-10), dict(breach=True))]),
    dict(id="collapse", expected="E5", objective="solo",
         path=["declare", "liberty", "independence", "rally", "challenge", "front", "conceal"],
         assets=["supply", "recon", "vanguard"],
         steps=[("charge_unscouted", dict(U=-15, O=10), dict(ignored_recon=True)),
                ("discrepancy_revealed", dict(P=-10, W=-12, R=-8), {}),
                ("refuse_regroup", dict(U=-15, O=10), dict(refused_regroup=True)),
                ("force_breach_after_warning", dict(U=-10, O=-15), dict(breach=True))]),
]


def main():
    examples = []
    for item in EXAMPLES:
        state = assemble(dict(zip(CHOICES, item["path"])), item["assets"])
        assert item["objective"] in plans(state), item["id"]
        entry = deepcopy(state)
        state["objective"] = item["objective"]
        history = []
        for name, effects, flags in item["steps"]:
            if name == "civilian_guides":
                assert state["I"] >= 35
            if name == "use_recon":
                assert "recon" in state["assets"]
            add(state, effects)
            state["flags"].update(flags)
            history.append(dict(action=name, P=state["P"], U=state["U"], O=state["O"]))
        result = resolve(state)
        assert result == item["expected"], (item["id"], result)
        examples.append(dict(id=item["id"], entry=entry, history=history, final=state, ending=result))

    counts = {key: 0 for key in ["joint", "staff", "rescue", "solo"]}
    total = 0
    for values in product(*(CHOICES[node] for node in CHOICES)):
        path = dict(zip(CHOICES, values))
        for assets in combinations(ASSETS, 3):
            available = plans(assemble(path, assets))
            assert available, path
            total += 1
            for mode in available:
                counts[mode] += 1

    # High stats alone must never fabricate objective completion or select an ending.
    for objective in counts:
        state = dict(BASE, assets=list(ASSETS), flags={}, objective=objective)
        state.update({key: 100 for key in BASE})
        assert resolve(state) == "E5"
    # A complete rescue is intentionally possible without influence/trust thresholds.
    low = dict(BASE, M=0, I=0, W=0, R=0, V=0, assets=[],
               flags=dict(civilians_out=True, wounded_out=True), objective="rescue")
    assert resolve(low) == "E2"

    report = dict(scope="Paper model: mainline entry combinations and authored action trajectories only; not play testing.",
                  profile_asset_combinations=total, entry_plan_counts=counts,
                  no_dead_end_at_entry=True, five_examples_reachable=True,
                  key_events_required=True, rescue_has_no_personality_gate=True,
                  examples=examples)
    target = Path(__file__).with_name("reachability-report.json")
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    print(json.dumps({key: value for key, value in report.items() if key != "examples"}, ensure_ascii=False, indent=2))
    for item in examples:
        s = item["final"]
        print(item["id"], item["ending"], {key: s[key] for key in BASE})


if __name__ == "__main__":
    main()
