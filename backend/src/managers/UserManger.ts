import { Socket } from "socket.io";
import { RoomManager } from "./RoomManager";

export interface User {
    socket: Socket;
    name: string;
}

export class UserManager {
    private users: User[];
    private queue: string[];
    private roomManager: RoomManager;

    constructor() {
        this.users = [];
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(name: string, socket: Socket) {
        this.users.push({
            name, socket
        });
        this.queue.push(socket.id);
        socket.emit("lobby");
        this.clearQueue();
        this.initHandlers(socket);
    }

    removeUser(socketId: string) {
        const user = this.users.find(x => x.socket.id === socketId);

        if (user) {
            // Find the room this user was in
            const roomId = this.roomManager.findRoomByUser(socketId);
            if (roomId) {
                // Remove the room and re-queue the other user
                const otherUserId = this.roomManager.removeRoom(roomId, socketId);
                if (otherUserId) {
                    this.queue.push(otherUserId);
                }
            }
        }

        // Remove user from users and queue
        this.users = this.users.filter(x => x.socket.id !== socketId);
        this.queue = this.queue.filter(x => x !== socketId);

        // Try to clear the queue again
        this.clearQueue();
    }

    clearQueue() {
        if (this.queue.length < 2) {
            return;
        }

        const id1 = this.queue.pop();
        const id2 = this.queue.pop();
        const user1 = this.users.find(x => x.socket.id === id1);
        const user2 = this.users.find(x => x.socket.id === id2);

        if (!user1 || !user2) {
            return;
        }

        this.roomManager.createRoom(user1, user2);
        this.clearQueue();
    }
    nextUser(socketId: string) {
        // Find the room this user is in
        const roomId = this.roomManager.findRoomByUser(socketId);
        if (roomId) {
            // Remove the room and re-queue the other user
            const otherUserId = this.roomManager.removeRoom(roomId, socketId);
            if (otherUserId) {
                this.queue.push(otherUserId);
            }
        }
        
        // Add the user back to the queue
        this.queue.push(socketId);
    
        // Try to clear the queue again
        this.clearQueue();
    }
    initHandlers(socket: Socket) {
        socket.on("offer", ({ sdp, roomId }: { sdp: string, roomId: string }) => {
            this.roomManager.onOffer(roomId, sdp, socket.id);
        });

        socket.on("answer", ({ sdp, roomId }: { sdp: string, roomId: string }) => {
            this.roomManager.onAnswer(roomId, sdp, socket.id);
        });

        socket.on("add-ice-candidate", ({ candidate, roomId, type }) => {
            this.roomManager.onIceCandidates(roomId, socket.id, candidate, type);
        });

        socket.on("disconnect", () => {
            this.removeUser(socket.id);
        });

        
        socket.on("next", () => {
            this.nextUser(socket.id);
        });
    }
}
