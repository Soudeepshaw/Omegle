import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom";
import { Room } from "./Room";

export const Landing = () => {
    const [name, setName] = useState("");
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setlocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [joined, setJoined] = useState(false);

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
    <Room name={name} localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} />
    )
}