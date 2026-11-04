import type { Point } from '../demo3d/Navigation';

export interface AccessibleRoom {
  id: string; x: number; z: number; width: number; depth: number;
  doors: Point[]; inside: boolean;
}

const contains = (room: AccessibleRoom, p: Point, inset: number) =>
  Math.abs(p.x-room.x)<room.width/2-inset && Math.abs(p.z-room.z)<room.depth/2-inset;

/** Only crossing a real doorway can arm an entrance; wall proximity has no effect. */
export class RoomAccess {
  private previous?: Point;
  private enteredDoor = new Set<string>();
  reset(rooms: AccessibleRoom[], position: Point) {
    this.previous={...position};this.enteredDoor.clear();
    for(const room of rooms)room.inside=contains(room,position,.24);
  }
  update(rooms: AccessibleRoom[], position: Point) {
    if(!this.previous){this.reset(rooms,position);return;}
    const previous=this.previous;
    for(const room of rooms){
      if(!room.inside)for(const door of room.doors){
        const inward=Math.sign(room.z-door.z);
        const from=(previous.z-door.z)*inward,to=(position.z-door.z)*inward;
        if(from<=0 && to>0){
          const fraction=-from/(to-from),crossX=previous.x+(position.x-previous.x)*fraction;
          if(Math.abs(crossX-door.x)<1.48)this.enteredDoor.add(room.id);
        }
      }
      if(this.enteredDoor.has(room.id)&&contains(room,position,.24)){
        room.inside=true;this.enteredDoor.delete(room.id);
      }
      if(!contains(room,position,-.32)){
        room.inside=false;this.enteredDoor.delete(room.id);
      }
    }
    this.previous={...position};
  }
}
