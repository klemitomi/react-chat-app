import { useContext, useEffect } from 'react'
import CustomMotion from '../components/CustomMotion'
import { LoadingContext } from '../contexts/LoadingContext';
import { AccessTokenContext } from '../contexts/AccessTokenContext';
import { UserInfoContext } from '../contexts/UserInfoContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../package.json'

export default function AgentChat() {

    const navigate = useNavigate();

    let initialized = false;

    const { loading, setLoading } = useContext(LoadingContext);
    const { accessToken, setAccessToken } = useContext(AccessTokenContext);
    const { userInfo, setUserInfo } = useContext(UserInfoContext);

    let timer = null;
    useEffect(() => {
        setLoading(true);
        if (!accessToken) {
            navigate("/agent");
            return;
        }

        timer = setInterval(() => {
            axios.get(`${config.backendUrl}/agents/info?accessToken=${accessToken}`).then(response => {
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
                    window.location.href = '/agent';
                }

                if (result.status === 2) {
                    setAccessToken(null);
                    alert(result.message);
                    window.location.href = '/agent';
                }
            }).catch(error => {
                alert("A szerver nem érhető el... Oldal újratöltése...");
                window.location.href = '/agent';
            });
        }, 2000);

        return () => {
            clearInterval(timer);
        }
    }, []);

    function nextClient() {
        setLoading(true);
        axios.get(`${config.backendUrl}/agents/open?accessToken=${accessToken}`).then(response => {
            setLoading(false);
            const result = response.data;

            if (result.status === 0) {
                console.log(result);
            } else {
                alert(result.message);
            }
        }).catch(error => {
            alert("A szerver nem érhető el... Oldal újratöltése...");
            window.location.href = '/agent';
        });
    }

    function handleClose() {
        setLoading(true);
        axios.get(`${config.backendUrl}/agents/close?accessToken=${accessToken}`)
            .then(response => { })
            .finally(() => setLoading(false));
    }

    function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        const formData = {
            message: event.target.message.value
        };
        event.target.message.value = "";

        axios.post(`${config.backendUrl}/agents/message?accessToken=${accessToken}`, formData).then(response => {
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

    if (userInfo.client) {
        return <CustomMotion className="chat">
            <div className="chat-detailed-box">
                <h2>{userInfo.client.name}</h2>
                <h3>Email: {userInfo.client.email} Telefonszám: {userInfo.client.phone}</h3>
                <hr />
                <button onClick={() => handleClose()}>Ügy lezárása</button>
                <form onSubmit={handleSubmit}><input type='text' id="message" placeholder='Üzenet....' /></form>
                {[...userInfo.client.conversation].reverse().map(message => (
                    <p key={message.ts + message.sender}>
                        <b>[{message.ts}] {message.sender}:</b> {message.message}
                    </p>
                ))}
            </div>
        </CustomMotion>
    }

    if (userInfo.stats.waiting === 0) {
        return <CustomMotion className="chat">
            <div className="chat-box">
                <h2>Nincs várakozó ügyfél</h2>
                Amennyiben lesz, frissítjük a felületet. Kérem NE frissítse kézzel.
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