import { BrowserRouter } from 'react-router-dom';

import './App.css'
import Content from './components/Content';
import { useEffect, useState } from 'react';

import config from '../package.json';
import axios from 'axios';

import { LoadingContext } from './contexts/LoadingContext'
import { AccessTokenContext } from './contexts/AccessTokenContext'
import Loading from './components/Loading'
import AgentLogin from './pages/AgentLogin';
import ClientChat from './pages/ClientChat';
import ClientLogin from './pages/ClientLogin';
import AgentChat from './pages/AgentChat';
import { UserInfoContext } from './contexts/UserInfoContext';

function App() {
  const pages = [
    { name: "Ügyfélportál", path: "/", element: <ClientLogin /> },
    { name: "Ügyfélportál Chat", path: "/chat", element: <ClientChat /> },
    { name: "Agent", path: "/agent", element: <AgentLogin /> },
    { name: "Agent Chat", path: "/agent/chat", element: <AgentChat /> },
  ];

  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);


  useEffect(() => {
    axios.get(`${config.backendUrl}/ping`).then(response => {
      if (response.data === "pong") {
        setLoading(false);
      } else {
        alert("A chat szerver nem a megfelelően működik.");
      }
    }).catch(error => alert("A chat szerver nem érhető el. Próbáld újra később!"));
  });

  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      <AccessTokenContext.Provider value={{ accessToken, setAccessToken }}>
        <UserInfoContext.Provider value={{ userInfo, setUserInfo }}>
          <BrowserRouter>
            {loading && <Loading />}
            <div className='App'>
              <Content routes={pages} />
            </div>
          </BrowserRouter>
        </UserInfoContext.Provider>
      </AccessTokenContext.Provider>
    </LoadingContext.Provider>
  )
}

export default App
