import { User } from "./UserManger";

let GLOBAL_ROOM_ID = 1;

interface Room {
    user1: User;
    user2: User;
}

export class RoomManager {
    private rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map<string, Room>();
    }

    createRoom(user1: User, user2: User) {
        const roomId = this.generate().toString();
        this.rooms.set(roomId, { user1, user2 });

        user1.socket.emit("send-offer", { roomId });
        user2.socket.emit("send-offer", { roomId });
    }

    onOffer(roomId: string, sdp: string, senderSocketid: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2 : room.user1;
        receivingUser?.socket.emit("offer", { sdp, roomId });
    }

    onAnswer(roomId: string, sdp: string, senderSocketid: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2 : room.user1;
        receivingUser?.socket.emit("answer", { sdp, roomId });
    }

    onIceCandidates(roomId: string, senderSocketid: string, candidate: any, type: "sender" | "receiver") {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2 : room.user1;
        receivingUser.socket.emit("add-ice-candidate", { candidate, type });
    }

    findRoomByUser(socketId: string): string | null {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.user1.socket.id === socketId || room.user2.socket.id === socketId) {
                return roomId;
            }
        }
        return null;
    }

    removeRoom(roomId: string, leavingUserId: string): string | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        this.rooms.delete(roomId);

        const remainingUser = room.user1.socket.id === leavingUserId ? room.user2 : room.user1;
        remainingUser.socket.emit("lobby");

        return remainingUser.socket.id;
    }

    generate() {
        return GLOBAL_ROOM_ID++;
    }

    switchUsers(roomId: string, leavingUserId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const otherUserId = room.user1.socket.id === leavingUserId ? room.user2.socket.id : room.user1.socket.id;

        // Remove the room and re-queue the users
        this.rooms.delete(roomId);

        // Emit "switch-user" event to the other user
        const otherUser = room.user1.socket.id === leavingUserId ? room.user2 : room.user1;
        otherUser.socket.emit("switch-user");

        // Re-queue both users
        this.removeRoom(roomId, leavingUserId);
        this.removeRoom(roomId, otherUserId);
    }
}
