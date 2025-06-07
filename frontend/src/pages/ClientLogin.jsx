import axios from "axios";
import CustomMotion from "../components/CustomMotion";
import config from '../../package.json';
import { useContext } from "react";
import { AccessTokenContext } from "../contexts/AccessTokenContext";
import { useNavigate } from "react-router-dom";

export default function ClientLogin(props) {

    const { accessToken, setAccessToken } = useContext(AccessTokenContext);
    const navigate = useNavigate();

    function handleSubmit(event) {
        event.preventDefault();
        const formData = {
            name: event.target.name.value,
            email: event.target.email.value,
            phone: event.target.phone.value
        }

        axios.post(`${config.backendUrl}/clients/open`, formData).then(response => {
            const result = response.data;
            if (result.status === 0) {
                setAccessToken(result.data);
                navigate("/chat");
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
                <h1>WeblerChat - Ügyfél</h1>
                <p>Munkatársunk kapcsolásához kérjük töltse ki az alábbi űrlapot.</p>
                <form onSubmit={handleSubmit}>
                    <input type="text" id="name" placeholder="Teljes név" autoComplete="off" />
                    <input type="text" id="email" placeholder="E-mail cím" autoComplete="off" />
                    <input type="text" id="phone" placeholder="Telefonszám" autoComplete="off" />
                    <button type="submit">Support kérése</button>
                </form>
            </div>
        </CustomMotion>
    )
}