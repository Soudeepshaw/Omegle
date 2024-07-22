import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";

const URL = "http://localhost:3000";

export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const socket = io(URL);

        socket.on('send-offer', async ({ roomId }) => {
            setLobby(false);
            const pc = new RTCPeerConnection();
            setSendingPc(pc);

            if (localVideoTrack) {
                pc.addTrack(localVideoTrack);
            }
            if (localAudioTrack) {
                pc.addTrack(localAudioTrack);
            }

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "sender",
                        roomId
                    });
                }
            };

            pc.onnegotiationneeded = async () => {
                const sdp = await pc.createOffer();
                pc.setLocalDescription(sdp);
                socket.emit("offer", {
                    sdp,
                    roomId
                });
            };
        });

        socket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
            setLobby(false);
            const pc = new RTCPeerConnection();
            pc.setRemoteDescription(remoteSdp);

            const sdp = await pc.createAnswer();
            pc.setLocalDescription(sdp);

            const stream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
            setRemoteMediaStream(stream);
            setReceivingPc(pc);

            pc.ontrack = (e) => {
                stream.addTrack(e.track);
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    socket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "receiver",
                        roomId
                    });
                }
            };

            socket.emit("answer", {
                roomId,
                sdp: sdp
            });

            setTimeout(() => {
                const track1 = pc.getTransceivers()[0].receiver.track
                const track2 = pc.getTransceivers()[1].receiver.track
                console.log(track1);
                if (track1.kind === "video") {
                    setRemoteAudioTrack(track2)
                    setRemoteVideoTrack(track1)
                } else {
                    setRemoteAudioTrack(track1)
                    setRemoteVideoTrack(track2)
                }
                //@ts-ignore
                remoteVideoRef.current.srcObject.addTrack(track1)
                //@ts-ignore
                remoteVideoRef.current.srcObject.addTrack(track2)
                //@ts-ignore
                remoteVideoRef.current.play();
                // if (type == 'audio') {
                //     // setRemoteAudioTrack(track);
                //     // @ts-ignore
                //     remoteVideoRef.current.srcObject.addTrack(track)
                // } else {
                //     // setRemoteVideoTrack(track);
                //     // @ts-ignore
                //     remoteVideoRef.current.srcObject.addTrack(track)
                // }
                // //@ts-ignore
            }, 5000)
        });
        

        socket.on("answer", ({ roomId, sdp: remoteSdp }) => {
            setLobby(false);
            setSendingPc(pc => {
                pc?.setRemoteDescription(remoteSdp);
                return pc;
            });
        });

        socket.on("lobby", () => {
            setLobby(true);
        });
        socket.on("next", () => {
            setLobby(true);
            // Reset streams and connections (same as in nextUser function)
            if (remoteMediaStream) {
                remoteMediaStream.getTracks().forEach(track => track.stop());
            }
            setRemoteMediaStream(null);
            setRemoteVideoTrack(null);
            setRemoteAudioTrack(null);
            
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            
            if (sendingPc) {
                sendingPc.close();
                setSendingPc(null);
            }
            if (receivingPc) {
                receivingPc.close();
                setReceivingPc(null);
            }
        });

        socket.on("add-ice-candidate", ({ candidate, type }) => {
            if (type === "sender") {
                setReceivingPc(pc => {
                    pc?.addIceCandidate(candidate);
                    return pc;
                });
            } else {
                setSendingPc(pc => {
                    pc?.addIceCandidate(candidate);
                    return pc;
                });
            }
        });

        setSocket(socket);
    }, [name, localAudioTrack, localVideoTrack]);

    useEffect(() => {
        if (localVideoRef.current && localVideoTrack) {
            localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
            localVideoRef.current.play();
        }
    }, [localVideoTrack]);

    const nextUser = () => {
        if (socket) {
            socket.emit("next");
            setLobby(true);
            
            // Reset streams and connections
            if (remoteMediaStream) {
                remoteMediaStream.getTracks().forEach(track => track.stop());
            }
            setRemoteMediaStream(null);
            setRemoteVideoTrack(null);
            setRemoteAudioTrack(null);
            
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            
            if (sendingPc) {
                sendingPc.close();
                setSendingPc(null);
            }
            if (receivingPc) {
                receivingPc.close();
                setReceivingPc(null);
            }
        }
    };

    return (
        <div>
            Hi {name}
            <video autoPlay width={400} height={400} ref={localVideoRef} />
            {lobby ? "Waiting to connect you to someone" : null}
            <video autoPlay width={400} height={400} ref={remoteVideoRef} />
            <button onClick={nextUser}>Next</button>
        </div>
    );
};
