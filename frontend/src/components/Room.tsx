import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";
import parse from 'html-react-parser';

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
    const [chatMessages, setChatMessages] = useState<Array<{ sender: string; content: string }>>([]);
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [geminiQuestion, setGeminiQuestion] = useState('');
    const [geminiResponses, setGeminiResponses] = useState<Array<{ question: string; answer: string }>>([]);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [smallVideos, setSmallVideos] = useState(false);



    useEffect(() => {
        const socket = io(URL);

        socket.on('send-offer', async ({ roomId }) => {
            setLobby(false);
            setCurrentRoomId(roomId);
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
                remoteVideoRef.current!.srcObject!.addTrack(track1)
                //@ts-ignore
                remoteVideoRef.current!.srcObject!.addTrack(track2)
                //@ts-ignore
                remoteVideoRef.current!.play();
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
        socket.on("gemini-response", ({ question, answer,forSocketId }) => {
            console.log('Received Gemini response:', { question, answer });
            if (socket.id === forSocketId){
                setGeminiResponses(prev => {
                    const newResponses = [...prev, { question, answer }];
                    console.log('Updated geminiResponses:', newResponses);
                    return newResponses;
                });
            }
            
            
        });
        socket.on("new-message", (message) => {
            setChatMessages(prev => [...prev, message]);
        });
        
        socket.on("lobby", () => {
            setLobby(true);
            setChatMessages([]);
            setGeminiResponses([]);
            setCurrentRoomId(null);
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
            setChatMessages([]);
            setCurrentRoomId(null);
            setGeminiResponses([]);
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
    const handleGeminiSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (geminiQuestion.trim() && socket && currentRoomId) {
            console.log('Sending Gemini request:', geminiQuestion, 'Room ID:', currentRoomId);
            socket.emit("gemini-request", { question: geminiQuestion, roomId:currentRoomId, socketId: socket.id });
            setGeminiQuestion('');
        }
        else{
            console.error('Unable to send Gemini request. Check socket, currentRoomId, or question.');
            console.log('Current state:', { socket: !!socket, currentRoomId, geminiQuestion });
        }
    };
    const sendMessage = (content: string) => {
        if (socket && currentRoomId) {
            const message = { sender: socket.id!, content };
            setChatMessages(prev => [...prev, message]);
            socket.emit("send-message", { roomId: currentRoomId, content, senderId: socket.id });
        }
    };
    
    
      return (
          <div className="room-container min-h-screen bg-gradient-to-r from-slate-800 via-gray-700 to-zinc-900 flex">
              <div className="main-content flex-grow flex flex-col justify-center items-center p-8">
                  <div className="user-info mb-6">
                      <h2 className="text-3xl font-bold text-white bg-opacity-70 bg-black px-4 py-2 rounded-lg shadow-md">Welcome, {name}!</h2>
                  </div>
                  <div className="video-container flex flex-col lg:flex-row gap-6 mb-8">
                      <div className="video-wrapper relative">
                          <video autoPlay muted playsInline width={480} height={360} ref={localVideoRef} className="video-feed rounded-xl shadow-2xl border-4 border-blue-400" />
                          <p className="absolute bottom-3 left-3 bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">You</p>
                      </div>
                      <div className="video-wrapper relative">
                          <video autoPlay playsInline width={480} height={360} ref={remoteVideoRef} className="video-feed rounded-xl shadow-2xl border-4 border-green-400" />
                          <p className="absolute bottom-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full font-semibold">Stranger</p>
                      </div>
                  </div>
                  {lobby ? (
                      <div className="lobby-message text-center bg-opacity-80 bg-black p-6 rounded-xl">
                          <p className="text-white text-xl mb-4">Waiting to connect you to someone...</p>
                          <div className="spinner w-16 h-16 border-6 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                  ) : (
                      <>
                          <button onClick={nextUser} className="next-button bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg mb-8">
                              Next
                          </button>
                      </>
                  )}
                  {!lobby && (
                      <div className="gemini-chat mt-8 w-full max-w-2xl">
                          <form onSubmit={handleGeminiSubmit} className="mb-4 flex">
                              <input
                                  type="text"
                                  value={geminiQuestion}
                                  onChange={(e) => setGeminiQuestion(e.target.value)}
                                  placeholder="Ask Gemini a question..."
                                  className="p-3 rounded-l-lg flex-grow bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold p-3 rounded-r-lg transition duration-300 ease-in-out">Ask</button>
                          </form>
                          <div className="responses bg-white bg-opacity-10 p-6 rounded-xl max-h-80 overflow-y-auto shadow-inner">
                              {geminiResponses && geminiResponses.length > 0 && geminiResponses.map((response, index) => (
                                  <div key={index} className="mb-4 last:mb-0 bg-opacity-30 bg-gray-700 p-4 rounded-lg">
                                      <p className="text-blue-300 mb-2"><strong>Q:</strong> {response.question}</p>
                                      <p className="text-white"><strong>A:</strong> {parse(response.answer)}</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
              <div className="chat-sidebar w-1/4 min-w-[300px] bg-gray-800 h-screen overflow-hidden flex flex-col">
                  <ChatBox 
                    chatMessages={chatMessages}
                    sendMessage={sendMessage}
                    socket={socket}
                  />
              </div>
          </div>
      );
    };
    const ChatBox = ({ chatMessages, sendMessage,socket}: { chatMessages: Array<{ sender: string; content: string }>, sendMessage: (content: string) => void, socket: Socket | null }) => {
        const [inputMessage, setInputMessage] = useState('');
        const chatContainerRef = useRef<HTMLDivElement>(null);
    
        const handleSendMessage = (e: React.FormEvent) => {
            e.preventDefault();
            if (inputMessage.trim()) {
                sendMessage(inputMessage);
                setInputMessage('');
            }
        };
    
        useEffect(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }, [chatMessages]);
    
        return (
            <div className="chat-container w-full max-w-2xl bg-white bg-opacity-10 rounded-xl shadow-lg overflow-hidden">
                <div ref={chatContainerRef} className="chat-messages p-4 h-96 overflow-y-auto">
                    {chatMessages.map((msg, index) => (
                        <div key={index} className={`mb-4 ${msg.sender === socket?.id ? 'text-left' : 'text-right'}`}>
                            <span className={`inline-block px-4 py-2 rounded-lg ${msg.sender === socket?.id ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}`}>
                                {msg.content}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">{msg.sender === socket?.id ? 'You' : 'Stranger'}</p>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSendMessage} className="chat-input flex p-4 bg-gray-800">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-grow p-2 rounded-l-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
                    />
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 transition duration-300">Send</button>
                </form>
            </div>
        );
    };