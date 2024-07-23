import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";
import parse from 'html-react-parser';

const URL = import.meta.env.VITE_API_URL || "http://localhost:3000";


export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
    isMuted: boolean,
    isCameraOff: boolean,
    toggleMute: () => void,
    toggleCamera: () => void,
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
    const [currentRoomId, setCurrentRoomId] = useState<string | null>
    (null);
    const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showChatBox, setShowChatBox] = useState(true);




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
        socket.on("remote-screen-share-started", () => {
            setIsRemoteScreenSharing(true);
          });
        
          socket.on("remote-screen-share-stopped", () => {
            setIsRemoteScreenSharing(false);
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
        if (localVideoTrack) {
            localVideoTrack.enabled = !isCameraOff;
          }
    }, [localVideoTrack, isCameraOff]);

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
    useEffect(() => {
        if (localAudioTrack) {
            localAudioTrack.enabled = !isMuted;
        }
    }, [localAudioTrack, isMuted]);
      
    const toggleScreenShare = async () => {
        if (isRemoteScreenSharing) {
            console.log("Remote user is already sharing screen. You can't share at the moment.");
            return;
          }
        if (!isScreenSharing) {
          try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            if (sendingPc && localVideoTrack) {
              const sender = sendingPc.getSenders().find(s => s.track?.kind === 'video');
              if (sender) {
                await sender.replaceTrack(screenTrack);
                }
                }
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = new MediaStream([screenTrack]);
            }
            setIsScreenSharing(true);
            screenTrack.addEventListener('ended', () => {
                stopScreenSharing();});
            socket?.emit("screen-share-started", { roomId: currentRoomId });
          } catch (error) {
            console.error('Error sharing screen:', error);
          }
        } else {
            stopScreenSharing();
        }
      };
      const stopScreenSharing = () => {
        if (sendingPc && localVideoTrack) {
          const sender = sendingPc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(localVideoTrack);
          }
        }
        if (localVideoRef.current && localVideoTrack) {
          localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
        }
        setIsScreenSharing(false);
        socket?.emit("screen-share-stopped", { roomId: currentRoomId });
      };
      const toggleChatBox = () => {
        setShowChatBox(prevState => !prevState);
    };
    
    
      return (
          <div className="room-container min-h-screen bg-gradient-to-r from-slate-800 via-gray-700 to-zinc-900 flex flex-col lg:flex-row">
              <div className="main-content flex-grow flex flex-col justify-center items-center p-4 lg:p-8">
                  <div className="user-info mb-4 lg:mb-6">
                      <h2 className="text-2xl lg:text-3xl font-bold text-white bg-opacity-70 bg-black px-3 py-1 lg:px-4 lg:py-2 rounded-lg shadow-md">Welcome, {name}!</h2>
                  </div>
                  <div className="video-container flex flex-col lg:flex-row gap-4 lg:gap-6 mb-6 lg:mb-8">
                      <div className="video-wrapper relative w-full lg:w-auto">
                          <video autoPlay muted playsInline width={isRemoteScreenSharing ? 240 : 480} height={isRemoteScreenSharing ? 180 : 360} ref={localVideoRef} className="video-feed rounded-xl shadow-2xl border-4 border-blue-400 w-full h-auto" />
                          <p className="absolute bottom-3 left-3 bg-blue-500 text-white px-2 py-1 text-sm lg:text-base rounded-full font-semibold">You</p>
                      </div>
                      <div className="video-wrapper relative w-full lg:w-auto">
                          <video autoPlay playsInline width={isRemoteScreenSharing ? 960 : 480} height={isRemoteScreenSharing ? 720 : 360} ref={remoteVideoRef} className="video-feed rounded-xl shadow-2xl border-4 border-green-400 w-full h-auto" />
                          <p className="absolute bottom-3 left-3 bg-green-500 text-white px-2 py-1 text-sm lg:text-base rounded-full font-semibold">Stranger</p>
                      </div>
                  </div>
                  <div className="controls-container flex flex-wrap justify-center gap-2 lg:gap-4 mb-6 lg:mb-8">
                      <button onClick={toggleMute} className="control-button bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 lg:px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg flex items-center text-sm lg:text-base">
                          {isMuted ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6 mr-1 lg:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                              </svg>
                          ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6 mr-1 lg:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                          )}
                          Toggle Mute
                      </button>
                      <button onClick={toggleCamera} className="control-button bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 lg:px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg flex items-center text-sm lg:text-base">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6 mr-1 lg:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Toggle Camera
                      </button>
                      <button onClick={toggleScreenShare}
                      disabled={isRemoteScreenSharing} className={`control-button ${isRemoteScreenSharing ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white font-bold py-2 px-3 lg:px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg flex items-center text-sm lg:text-base`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6 mr-1 lg:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {isScreenSharing ? 'Stop Share' : isRemoteScreenSharing ? 'Remote Sharing' : 'Share Screen'}
                      </button>
                      <button onClick={toggleChatBox} className="control-button bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 lg:px-4 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg flex items-center text-sm lg:text-base">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 lg:h-6 lg:w-6 mr-1 lg:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {showChatBox ? 'Close Chat' : 'Open Chat'}
                      </button>
                  </div>
                  {lobby ? (
                      <div className="lobby-message text-center bg-opacity-80 bg-black p-4 lg:p-6 rounded-xl">
                          <p className="text-white text-lg lg:text-xl mb-3 lg:mb-4">Waiting to connect you to someone...</p>
                          <div className="spinner w-12 h-12 lg:w-16 lg:h-16 border-4 lg:border-6 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                  ) : (
                      <>
                          <button onClick={nextUser} className="next-button bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 lg:py-3 lg:px-6 rounded-full transition duration-300 ease-in-out transform hover:scale-105 shadow-lg mb-6 lg:mb-8">
                              Next
                          </button>
                      </>
                  )}
                  {!lobby && (
                      <div className="gemini-chat mt-6 lg:mt-8 w-full max-w-2xl px-4 lg:px-0">
                          <form onSubmit={handleGeminiSubmit} className="mb-4 flex">
                              <input
                                  type="text"
                                  value={geminiQuestion}
                                  onChange={(e) => setGeminiQuestion(e.target.value)}
                                  placeholder="Ask Gemini a question..."
                                  className="p-2 lg:p-3 rounded-l-lg flex-grow bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold p-2 lg:p-3 rounded-r-lg transition duration-300 ease-in-out">Ask</button>
                          </form>
                          <div className="responses bg-white bg-opacity-10 p-4 lg:p-6 rounded-xl max-h-60 lg:max-h-80 overflow-y-auto shadow-inner">
                              {geminiResponses && geminiResponses.length > 0 && geminiResponses.map((response, index) => (
                                  <div key={index} className="mb-3 lg:mb-4 last:mb-0 bg-opacity-30 bg-gray-700 p-3 lg:p-4 rounded-lg">
                                      <p className="text-blue-300 mb-1 lg:mb-2 text-sm lg:text-base"><strong>Q:</strong> {response.question}</p>
                                      <p className="text-white text-sm lg:text-base"><strong>A:</strong> {parse(response.answer)}</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
              <div className={`chat-sidebar w-full lg:w-1/4 lg:min-w-[300px] bg-gray-800 h-screen overflow-hidden flex flex-col ${showChatBox ? '' : 'hidden'}`}>
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
                <div ref={chatContainerRef} className="chat-messages p-4 overflow-y-auto h-96 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
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