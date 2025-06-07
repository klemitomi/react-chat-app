import axios from "axios";
import CustomMotion from "../components/CustomMotion";
import config from '../../package.json';
import { useContext } from "react";
import { AccessTokenContext } from "../contexts/AccessTokenContext";
import { useNavigate } from "react-router-dom";

export default function AgentLogin(props) {

    const {accessToken, setAccessToken} = useContext(AccessTokenContext);
    const navigate = useNavigate();

    function handleSubmit(event) {
        event.preventDefault();
        const formData = {
            username: event.target.username.value,
            password: event.target.password.value
        }

        axios.post(`${config.backendUrl}/agents/login`, formData).then(response => {
            const result = response.data;
            if (result.status === 0) {
                setAccessToken(result.data);
                navigate("/agent/chat");
            } else {
                alert(result.message);
            }
        }).catch(error => {
            alert("Hiba, a szerver nem érhető el... Az oldal újratöltése...");
            window.location.href = '/agent';
        });
    }

    return (
        <CustomMotion className="Login">
            <div className="login-box">
                <h1>WeblerChat - Ügynök</h1>

                <form onSubmit={handleSubmit}>
                    <input type="text" id="username" placeholder="Felhasználói név" autoComplete="off" />
                    <input type="text" id="password" placeholder="Jelszó" autoComplete="off" />
                    <button type="submit">Belépés</button>
                </form>
            </div>
        </CustomMotion>
    )
}