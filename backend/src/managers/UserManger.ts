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
            const roomId = this.roomManager.findRoomByUser(socketId);
            if (roomId) {
                const [user1Id, user2Id] = this.roomManager.removeRoom(roomId);
                if (user1Id !== socketId) this.queue.push(user1Id);
                if (user2Id !== socketId) this.queue.push(user2Id);
            }
        }
        this.users = this.users.filter(x => x.socket.id !== socketId);
        this.queue = this.queue.filter(x => x !== socketId);
        this.clearQueue();
    }

    
    clearQueue() {
        while (this.queue.length >= 2) {
            const id1 = this.queue.shift()!;
            const id2 = this.queue.shift()!;
            const user1 = this.users.find(x => x.socket.id === id1);
            const user2 = this.users.find(x => x.socket.id === id2);
            if (user1 && user2) {
                this.roomManager.createRoom(user1, user2);
            }
        }
    }
    nextUser(socketId: string) {
        const roomId = this.roomManager.findRoomByUser(socketId);
        if (roomId) {
            const [user1Id, user2Id] = this.roomManager.removeRoom(roomId);
            this.queue.push(user1Id, user2Id);
        }
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
        socket.on("gemini-request", ({ question, roomId }: { question: string, roomId: string }) => {
            console.log(`Received Gemini request from socket ${socket.id} in room ${roomId}`);
            console.log(`Question: "${question}"`);
            this.roomManager.handleGeminiRequest(roomId, question, socket.id);
        });
    }
}

