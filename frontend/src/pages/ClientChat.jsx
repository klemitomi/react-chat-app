import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingContext } from "../contexts/LoadingContext";
import { AccessTokenContext } from "../contexts/AccessTokenContext";
import { UserInfoContext } from "../contexts/UserInfoContext";
import axios from 'axios';
import config from '../../package.json'
import CustomMotion from "../components/CustomMotion";

export default function ClientChat() {
    const navigate = useNavigate();

    let initialized = false;

    const { loading, setLoading } = useContext(LoadingContext);
    const { accessToken, setAccessToken } = useContext(AccessTokenContext);
    const { userInfo, setUserInfo } = useContext(UserInfoContext);

    let timer = null;
    useEffect(() => {
        setLoading(true);
        if (!accessToken) {
            navigate("/");
            return;
        }

        timer = setInterval(() => {
            axios.get(`${config.backendUrl}/clients/info?accessToken=${accessToken}`).then(response => {
                if (!initialized) {
                    setLoading(false);
                    initialized = true;
                }
                const result = response.data;

                if (result.status === 0) {
                    setUserInfo(result.data);
                }

                if (result.status === 1) {
                    setAccessToken(null);
                    alert(result.message);
                    window.location.href = '/';
                }

                if (result.status === 2) {
                    setAccessToken(null);
                    alert(result.message);
                    window.location.href = '/';
                }
            }).catch(error => {
                alert("A szerver nem érhető el... Oldal újratöltése...");
                window.location.href = '/';
            });
        }, 2000);

        return () => {
            clearInterval(timer);
        }
    }, []);

    function handleLogout() {
        setLoading(true);
        axios.get(`${config.backendUrl}/clients/logout?accessToken=${accessToken}`)
            .then(response => { })
            .finally(() => {
                setLoading(false);
                navigate('/');
            });
    }

    function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        const formData = {
            message: event.target.message.value
        };
        event.target.message.value = "";

        axios.post(`${config.backendUrl}/clients/send?accessToken=${accessToken}`, formData).then(response => {
            const result = response.data;
            setLoading(false);
            if (result.status != 0) {
                alert(result.message);
            }

        });
    }

    if (!userInfo || !accessToken) {
        return <></>
    }

    if (userInfo.stats.onlineAgents === 0) {
        return <CustomMotion className="chat">
            <div className="chat-box">
                <h2>Üdv {userInfo.me.name},</h2>
                sajnos jelenleg nincs online ügyintéző a chaten. Kérem várjon vagy jöjjön vissza később...
            </div>
        </CustomMotion>
    }

    if (userInfo.me.status === 0) {
        return <CustomMotion className="chat">
            <div className="chat-box">
                <h2>Üdv {userInfo.me.name},</h2>
                várólistán van... Ön előtt áll {userInfo.stats.queue} fő..
            </div>
        </CustomMotion>
    }

    if (userInfo.me.status === 1) {
        return <CustomMotion className="chat">
            <div className="chat-detailed-box">
                <h2>{userInfo.agent.agent.name}</h2>
                <hr />
                <form onSubmit={handleSubmit}><input type='text' id="message" placeholder='Üzenet....' /></form>
                {[...userInfo.me.conversation].reverse().map(message => (
                    <p key={message.ts + message.sender}>
                        <b>[{message.ts}] {message.sender}:</b> {message.message}
                    </p>
                ))}
            </div>
        </CustomMotion>
    }

    if (userInfo.me.status === 2) {
        return <CustomMotion className="chat">
            <div className="chat-detailed-box">
                <h2>A beszélgetés véget ért</h2>
                <hr />
                {[...userInfo.me.conversation].reverse().map(message => (
                    <p key={message.ts + message.sender}>
                        <b>[{message.ts}] {message.sender}:</b> {message.message}
                    </p>
                ))}
            </div>
        </CustomMotion>
    }

    return (
        <CustomMotion className="chat">
            <div className="chat-box">
                <h2>{userInfo.stats.waiting} várakozó ügyfél</h2>
                <h3>{userInfo.stats.onlineAgents.length} bejelentkezett ügyintéző, {userInfo.stats.onlineAgents.length - userInfo.stats.inconversation} szabad</h3>

                <button onClick={() => nextClient()}>Következő ügyfél fogadása</button>
            </div>
        </CustomMotion>
    )
}