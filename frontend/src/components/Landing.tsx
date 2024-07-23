import { useEffect, useRef, useState } from "react"

import { Room } from "./Room";

export const Landing = () => {
    const [name, setName] = useState("");
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setlocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [joined, setJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);


    const getCam = async () => {
        const stream = await window.navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        })
        // MediaStream
        const audioTrack = stream.getAudioTracks()[0]
        const videoTrack = stream.getVideoTracks()[0]
        setLocalAudioTrack(audioTrack);
        setlocalVideoTrack(videoTrack);
        if (!videoRef.current) {
            return;
        }
        videoRef.current.srcObject = new MediaStream([videoTrack])
        videoRef.current.play();
        // MediaStream
    }

    useEffect(() => {
        if (videoRef && videoRef.current) {
            getCam()
        }
    }, [videoRef]);
    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (localAudioTrack) {
            localAudioTrack.enabled = isMuted;
        }
    };

    const toggleCamera = () => {
        setIsCameraOff(!isCameraOff);
        if (localVideoTrack) {
            localVideoTrack.enabled = isCameraOff;
        }
    };

    if (!joined) {
            
    return <div className="h-screen bg-gradient-to-r from-slate-800 via-gray-500 to-zinc-950 flex justify-center items-center">
        <div className="flex flex-col items-center">
            <div className="mb-4 w-64 h-96 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
                <video autoPlay ref={videoRef} className="w-full h-full object-cover"></video>
            </div>
            <input
                type="text"
                onChange={(e) => {
                    setName(e.target.value);
                }}
                onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                        setJoined(true);
                    }
                }}
                className="mb-2 px-4 py-2 border rounded-lg"
            />
            <div className="flex space-x-2 mb-4">
                        <button
                            onClick={toggleMute}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            {isMuted ? 'Unmute' : 'Mute'}
                        </button>
                        <button
                            onClick={toggleCamera}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            {isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                        </button>
                    </div>
            <button
                className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 px-4 py-2 rounded-lg text-white font-bold"
                onClick={() => {
                    setJoined(true);
                }}
            >
                Join
            </button>
        </div>
    </div>    }

    return (
    <Room name={name} localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} 
    isMuted={isMuted}
    isCameraOff={isCameraOff}
    toggleMute={toggleMute}
    toggleCamera={toggleCamera}/>
    )
}