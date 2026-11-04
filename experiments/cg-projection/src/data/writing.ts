import { bi, f, cat, type Text, type BiText } from '../i18n/text';
export const dispatchBins = ['PRIORITY', 'ACTION', 'CONTEXT'] as const;
export type DispatchBin = typeof dispatchBins[number];
export const binNames: Record<DispatchBin, BiText> = { PRIORITY: bi("优先事项 · 目标与时限", "Priority · Objective and deadline"), ACTION: bi("执行任务 · 人员与补给", "Action · Personnel and supplies"), CONTEXT: bi("背景信息 · 地点与状况", "Context · Location and conditions") };
export interface DispatchFragment { id: string; label: BiText; text: BiText; bin: DispatchBin }
export const dispatches: { title: BiText; fragments: DispatchFragment[] }[] = [
  { title: bi("北线补给", "Northern Supplies"), fragments: [
    { id: 'north-supplies', label: bi('补给', 'SUPPLIES'), text: bi("运送面粉二十桶、药品两箱。", "Deliver twenty barrels of flour and two crates of medicine."), bin: 'ACTION' },
    { id: 'north-position', label: bi('地点', 'POSITION'), text: bi("接收地点为北线河岸营地。", "The receiving point is the northern riverside camp."), bin: 'CONTEXT' },
    { id: 'north-time', label: bi('时限', 'TIME'), text: bi("明日拂晓前必须抵达。", "Arrive before dawn tomorrow."), bin: 'PRIORITY' },
    { id: 'north-troops', label: bi('人员', 'TROOPS'), text: bi("由军需官率一队士兵护送车队。", "The quartermaster leads a squad escorting the wagons."), bin: 'ACTION' },
    { id: 'north-objective', label: bi('目标', 'OBJECTIVE'), text: bi("首先解除北线断粮的危险。", "First, prevent the northern troops from running out of food."), bin: 'PRIORITY' },
  ] },
  { title: bi("转移伤员", "Move the Wounded"), fragments: [
    { id: 'medical-position', label: bi('地点', 'POSITION'), text: bi("旧石桥受损，东岸渡口仍可通行。", "The old stone bridge is damaged; the eastern ferry still operates."), bin: 'CONTEXT' },
    { id: 'medical-troops', label: bi('人员', 'TROOPS'), text: bi("医官带担架队经渡口护送伤员。", "The surgeon leads the stretcher party across the ferry."), bin: 'ACTION' },
    { id: 'medical-objective', label: bi('目标', 'OBJECTIVE'), text: bi("优先将重伤员转移到后方医院。", "Move the seriously wounded to the rear hospital first."), bin: 'PRIORITY' },
    { id: 'medical-supplies', label: bi('补给', 'SUPPLIES'), text: bi("携带绷带、饮水与两辆空车。", "Bring bandages, water, and two empty wagons."), bin: 'ACTION' },
    { id: 'medical-time', label: bi('时限', 'TIME'), text: bi("今晚日落前完成转移。", "Complete the transfer before sunset today."), bin: 'PRIORITY' },
  ] },
  { title: bi("准备集结", "Prepare to Muster"), fragments: [
    { id: 'muster-time', label: bi('时限', 'TIME'), text: bi("后日清晨六时前完成准备。", "Finish preparations by six the morning after tomorrow."), bin: 'PRIORITY' },
    { id: 'muster-objective', label: bi('目标', 'OBJECTIVE'), text: bi("首要任务是保障各队准时集结。", "The first priority is to have every squad muster on time."), bin: 'PRIORITY' },
    { id: 'muster-position', label: bi('地点', 'POSITION'), text: bi("集结地在磨坊以南的空地。", "The muster point is the clearing south of the mill."), bin: 'CONTEXT' },
    { id: 'muster-supplies', label: bi('补给', 'SUPPLIES'), text: bi("每队领取两日口粮并核对弹药。", "Each squad collects two days of rations and checks its ammunition."), bin: 'ACTION' },
    { id: 'muster-troops', label: bi('人员', 'TROOPS'), text: bi("传令兵通知各队队长清点人数。", "A messenger tells each squad leader to count their men."), bin: 'ACTION' },
  ] },
];
