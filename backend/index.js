const fs = require('fs');
const express = require('express');
const bodyParser = require("body-parser");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const package = require('./package.json')
const df = require('./dateformatter');
const agents = require('./agents.json');
const payload = require('./payload.json');

Date.prototype.format = function (mask, utc) {
    return df.dateFormat(this, mask, utc);
};

class Status {
    static WAITING = 0;
    static IN_CONVERSATION = 1;
    static CLOSED = 2;
    static CANCELLED = 3;
}

let runningNumber = 1;
const sessionsAgentSchema = { accessToken: String, agent: Object, status: Number, lastActivity: Number };
const sessionsClientSchema = { id: Number, accessToken: String, name: String, email: String, phone: String, status: Number, agentId: Number, lastActivity: Number, conversation: Array };

const sessions = {
    agents: [],
    clients: []
};

const service = express();

service.use(cors());
service.use(bodyParser.urlencoded({ extended: false }));
service.use(bodyParser.json());

/**
 * Függvény, amivel ellenőrizhető, hogy a szerver elérhető-e
 * @REQUEST GET /ping
 * @RESPONSE Egyszerű pong üzenet
 */
service.get('/ping', function (req, res) {
    console.log("GET /ping: pong");
    res.send("pong");
});

/**
 * Functions for agents
 */

/**
 * Függvény, ami az ügynökök számára munkavégzés céljából bejelentkezési lehetőséget biztosít.
 * @REQUEST POST /agents/login (GET: -, POST: username, password)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Sikeres belépés, 1:Hiányzó paraméterek; 2:Nem található felhasználó}
 * data {null: A bejelentkezés nem sikerült, String: A későbbi azonosításhoz használandó egyedi kód, accessToken}
 */
service.post('/agents/login', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };

    try {
        mandatoryFieldsAreOkay(req, [], ["username", "password"]);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    const filteredAgents = agents.filter(a => a.username === post.username && a.password === post.password);
    if (filteredAgents.length === 0) {
        console.log(`POST /agents/login {username: ${post.username}}: Not found.`);
        result.status = 2;
        result.message = "Felhasználó nem található.";
        res.send(result);
        return;
    }

    let agent = { ...filteredAgents[0] }
    delete agent.password;

    const sessionAgent = {};
    sessionAgent.accessToken = uuidv4();
    sessionAgent.lastActivity = Date.now();
    sessionAgent.agent = agent;

    console.log(`POST /agents/login {username: ${sessionAgent.agent.username}}: ${sessionAgent.agent.name} ${sessionAgent.accessToken}.`);
    sessions.agents.push(sessionAgent);
    result.status = 0;
    result.message = "OK";
    result.data = sessionAgent.accessToken;
    res.send(result);
});

/**
 * Függvény, ami az ügynökök számára munkavégzés céljából ellenőrzi a bejelentkezés állapotát
 * @REQUEST GET /agents/info (GET: accessToken, POST: -)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek; 2:Nem található accessToken}
 */
service.get('/agents/info', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };

    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    let currentAgent = agentFetchCurrentAgent(sessions.agents, get.accessToken);
    if (!currentAgent) {
        console.log(`GET /agents/info {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "AccessToken nem található";
        res.send(result);
        return;
    }

    let client = sessions.clients.filter(e => e.agentId === currentAgent.agent.id);

    result.status = 0;
    result.data = {
        me: currentAgent,
        client: client.length === 0 ? null : client[0],
        stats: {
            waiting: sessions.clients.filter(c => c.status === Status.WAITING).length,
            inconversation: sessions.clients.filter(c => c.status === Status.IN_CONVERSATION).length,
            done: sessions.clients.filter(c => c.status === Status.CLOSED).length,
            cancelled: sessions.clients.filter(c => c.status === Status.CANCELLED).length,
            onlineAgents: sessions.agents
        }
    }
    res.send(result);
});

/**
 * Beszélgetés lezárása, ha az ügyfél nem válaszol vagy az ügyintézés befejeződött
 * @REQUEST GET /agents/close (GET: accessToken)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek; 2:Nem található accessToken}
 */
service.get('/agents/close', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };

    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    let currentAgent = agentFetchCurrentAgent(sessions.agents, get.accessToken);

    if (!currentAgent) {
        console.log(`GET /agents/close {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "AccessToken nem található";
        res.send(result);
        return;
    }

    let currentClient = agentFetchCurrentClient(sessions.clients, currentAgent);
    if (currentClient) {
        currentClient.status = Status.CLOSED;
        currentClient.agentId = null;
        console.log(`GET /agents/close {Agent: ${currentAgent.agent.name}}: Closed the conversation with ${currentClient.name}.`);
    }

    result.status = 0;
    res.send(result);
});

/**
 * Új ügyfél kérése
 * @REQUEST GET /agents/open (GET: accessToken)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek; 2:Nem található accessToken}
 */
service.get('/agents/open', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };

    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    let currentAgent = agentFetchCurrentAgent(sessions.agents, get.accessToken);
    if (!currentAgent) {
        console.log(`GET /agents/open {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "AccessToken nem található";
        res.send(result);
        return;
    }

    let currentClient = agentFetchCurrentClient(sessions.clients, currentAgent);;
    if (!currentClient) {
        let nextClient = agentFetchNextClient(sessions.clients);
        if (!nextClient) {
            console.log(`GET /agents/open {Agent: ${currentAgent.agent.name}}: No more waiting client.`);
            result.status = 0;
            result.message = "Nincs várakozó ügyfél";
        } else {
            nextClient.status = Status.IN_CONVERSATION;
            nextClient.agentId = currentAgent.agent.id;
            nextClient.conversation.push({
                ts: new Date().format("yyyy-mm-dd HH:MM:ss"),
                sender: currentAgent.agent.name,
                message: `Üdvözlöm, az én nevem ${currentAgent.agent.name}. Én leszek az Ön segítségére a problémája megoldásában. Miben segíthetek?`
            });
            result.status = 0;
            result.data = nextClient;
            console.log(`GET /agents/open {Agent: ${currentAgent.agent.name}}: Started the conversation with ${result.data.name}.`);
        }
    }

    res.send(result);
});

/**
 * Üzenet küldése az aktív (IN_CONVERSATION) ügyfél részére
 * @REQUEST POST /agents/message (GET: accessToken, POST: message)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek; 2:Nem található accessToken, 3:A beszélgetés nincs aktív állapotban, 4:Nincs aktív ügyfél}
 */
service.post('/agents/message', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };
    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    let currentAgent = agentFetchCurrentAgent(sessions.agents, get.accessToken);

    if (!currentAgent) {
        console.log(`POST /agents/message {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "AccessToken nem található";
        res.send(result);
        return;
    }

    let currentClient = agentFetchCurrentClient(sessions.clients, currentAgent);
    if (currentClient) {
        if (currentClient.status === Status.IN_CONVERSATION) {
            console.log(`POST /agents/message {agent: ${currentAgent.agent.name} -> client: ${currentClient.name}}: MSG: ${post.message}`);
            currentClient.conversation.push({
                ts: new Date().format("yyyy-mm-dd HH:MM:ss"),
                sender: currentAgent.agent.name,
                message: post.message
            });
            result.status = 0;
            result.data = currentClient;
        } else {
            console.log(`POST /agents/message {agent: ${currentAgent.agent.name} -> client: ${currentClient.name}}: FAILED: The conversation is in ${currentClient.status} state.`);
            result.status = 3;
            result.message = "A beszélgetés nincs aktív állapotban.";
            result.data = currentClient;
        }
    } else {
        console.log(`POST /agents/message {agent: ${currentAgent.agent.name} -> client: ${currentClient.name}}: FAILED: No active client.`);
        result.status = 4;
        result.message = "Nincs aktív ügyfél";
    }
    res.send(result);
});

/**
 * Ügyintéző kijelentkezik
 * @REQUEST GET /agents/logout (GET: accessToken)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek, 2:Nem található accessToken}
 */
service.get('/agents/logout', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };
    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    let currentAgent = agentFetchCurrentAgent(sessions.agents, get.accessToken);

    if (!currentAgent) {
        console.log(`GET /agents/logout {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "Nem található accessToken";
        res.send(result);
        return;
    }

    console.log(`GET /agents/logout {Agent: ${currentAgent.agent.name}}: Log out.`);

    let currentClient = agentFetchCurrentClient(sessions.clients, currentAgent);
    if (currentClient) {
        currentClient.status = Status.CLOSED;
        currentClient.agent = null;
        console.log(`GET /agents/logout {Agent: ${currentAgent.agent.name}}: Conversation ended with ${currentClient.name}.`);
    }

    sessions.agents.splice(sessions.agents.findIndex(e => e.accessToken === currentAgent.accessToken), 1);

    result.status = 0;
    res.send(result);
});

/**
 * Function for clients
 */

/**
 * Csevegés indítása ügyfélként
 * @REQUEST POST /clients/open (GET: -, POST: name, email, phone)
 * @RESPONSE {status: 0|1, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek}
 */
service.post("/clients/open", function (req, res) {
    const post = req.body;
    const get = req.query;
    let client = { id: runningNumber, accessToken: uuidv4(), name: post.name, email: post.email, phone: post.phone, status: Status.WAITING, agentId: null, lastActivity: Date.now(), conversation: [] }
    runningNumber++;
    
    let result = { ...payload };
    try {
        mandatoryFieldsAreOkay(req, [], ["name", "email", "phone"]);
        if (post.name.length === 0 || post.email.length === 0 || post.phone.length === 0) {
            throw Error("Please fill all fields.");
        }
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    sessions.clients.push(client);
    result.data = client.accessToken;
    console.log(`POST /clients/open {Client: ${client.name} AuthToken: ${client.accessToken}}: Entered the waiting list.`);
    res.send(result);
    return;
});

/**
 * Általános adatok lekérdezése
 * @REQUEST GET /clients/info (GET: accessToken)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek, 2:Nem található accessToken}
 */
service.get("/clients/info", function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };
    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    const currentClient = clientFetchCurrentClient(sessions.clients, get.accessToken);
    if (!currentClient) {
        result.status = 2;
        result.message = "Nem található accessToken";
        res.send(result);
        return;
    }

    let agentData = currentClient.agentId !== null ? { ...sessions.agents.filter(a => a.agent.id === currentClient.agentId)[0] } : null;
    if (agentData) {
        delete agentData.accessToken;
    }
    result.data = {
        me: currentClient,
        agent: agentData,
        stats: {
            queue: sessions.clients.filter(e => e.status === Status.WAITING && e.id < currentClient.id).length,
            waiting: sessions.clients.filter(c => c.status === Status.WAITING).length,
            inconversation: sessions.clients.filter(c => c.status === Status.IN_CONVERSATION).length,
            done: sessions.clients.filter(c => c.status === Status.CLOSED).length,
            cancelled: sessions.clients.filter(c => c.status === Status.CANCELLED).length,
            onlineAgents: sessions.agents.length
        }
    }


    res.send(result);
    return;
});

/**
 * Üzenet küldése az ügyintézőnek
 * @REQUEST POST /clients/send (GET: accessToken, POST: message)
 * @RESPONSE {status: 0|1|2|3, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek, 2:Nem található accessToken, 3:Lezárt beszélgetés}
 */
service.post("/clients/send", function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };
    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], ["message"]);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }

    let currentClient = clientFetchCurrentClient(sessions.clients, get.accessToken);

    if (!currentClient) {
        console.log(`POST /clients/send {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "Érvénytelen accessToken";
        res.send(result);
        return;
    }

    if (currentClient.status !== Status.IN_CONVERSATION) {
        console.log(`POST /clients/send {accessToken: ${get.accessToken} client: ${currentClient.name}}: No active agent.`);
        result.status = 3;
        result.message = "A beszélgetés le van zárva, ezért nem küldhető üzenet.";
        res.send(result);
        return;
    }

    currentClient.conversation.push({
        ts: new Date().format("yyyy-mm-dd HH:MM:ss"),
        sender: currentClient.name,
        message: post.message
    });

    result.data = currentClient;
    res.send(result);
});

/**
 * Ügyfél kijelentkezik, bezárja a beszélgetést
 * @REQUEST GET /clients/logout (GET: accessToken)
 * @RESPONSE {status: 0|1|2, data: object}
 * status {0: Minden rendben, 1:Hiányzó paraméterek, 2:Nem található accessToken}
 */
service.get('/clients/logout', function (req, res) {
    const post = req.body;
    const get = req.query;

    let result = { ...payload };
    try {
        mandatoryFieldsAreOkay(req, ["accessToken"], []);
    } catch (e) {
        result.status = 1;
        result.message = e.message;
        res.send(result);
        return;
    }
    let currentClient = clientFetchCurrentClient(sessions.clients, get.accessToken);

    if (!currentClient) {
        console.log(`GET /clients/logout {accessToken: ${get.accessToken}}: Invalid accessToken.`);
        result.status = 2;
        result.message = "Érvénytelen accessToken";
        res.send(result);
        return;
    }

    console.log(`GET /clients/logout {Client: ${currentClient.name}}: Log out manually.`);

    if (currentClient.status === Status.WAITING) {
        currentClient.status = Status.CANCELLED;
        console.log(`GET /clients/logout {Client: ${currentClient.name}}: Conversation cancelled.`);
    }
    if (currentClient.status === Status.IN_CONVERSATION) {
        currentClient.status = Status.CLOSED;
        console.log(`GET /clients/logout {Client: ${currentClient.name}}: Conversation ended with the agent.`);
    }

    res.send(result);
});

/**
 * General functions
 */

service.listen(package.port, function () {
    console.log(`Chat server is running on port ${package.port} at ${new Date().format("yyyy-mm-dd HH:MM:ss")}...`);
});

function agentFetchCurrentAgent(agentList, accessToken) {
    let filteredOnlineAgents = agentList.filter(agent => agent.accessToken === accessToken);
    if (filteredOnlineAgents.length === 0) {
        return null;
    }
    filteredOnlineAgents[0].lastActivity = Date.now();
    return filteredOnlineAgents[0];
}

function agentFetchNextClient(clientList) {
    let filteredClients = clientList.filter(client => client.status === Status.WAITING);
    if (filteredClients.length > 0) {
        return filteredClients[0];
    }
    return null;
}

function agentFetchCurrentClient(clientList, currentAgent) {
    let filteredClients = clientList.filter(client => client.agentId === currentAgent.agent.id);
    if (filteredClients.length > 0) {
        return filteredClients[0];
    }
    return null;
}

function clientFetchCurrentClient(clientList, accessToken) {
    let filtered = clientList.filter(client => client.accessToken === accessToken);
    if (filtered.length === 0) {
        return null;
    }
    filtered[0].lastActivity = Date.now();
    return filtered[0];
}

function mandatoryFieldsAreOkay(req, getFields = [], postFields = []) {
    const post = req.body;
    const get = req.query;

    if (getFields.filter(field => get[field] === undefined || get[field] === null) > 0) {
        throw Error(`Hiányzó kötelező paraméter (GET: ${field}). Kötelező paraméterek: GET: ${getFields.toString()} POST: ${postFields.toString()}.`);
    }

    if (postFields.filter(field => post[field] === undefined || post[field] === null) > 0) {
        throw Error(`Hiányzó kötelező paraméter (POST: ${field}). Kötelező paraméterek: GET: ${getFields.toString()} POST: ${postFields.toString()}.`);
    }
}

setInterval(function () {
    let inactivityMarker = Date.now() - (1 * 60 * 1000)
    let inactiveAgents = sessions.agents.filter(a => inactivityMarker > a.lastActivity);
    let inactiveClients = sessions.clients.filter(a => inactivityMarker > a.lastActivity && (a.status === Status.IN_CONVERSATION || a.status === Status.WAITING));

    for (let agent of inactiveAgents) {
        let affectedActiveClient = agentFetchCurrentClient(sessions.clients, agent);
        if (affectedActiveClient !== null) {
            affectedActiveClient.status = Status.WAITING;
            affectedActiveClient.conversation.push({
                ts: new Date().format("yyyy-mm-dd HH:MM:ss"),
                sender: 'SYSTEM',
                message: `${agent.agent.name} ügyintézővel a kapcsolat technikai okok miatt megszakadt. Hamarosan összekapcsoljuk egy másik ügyintézővel. Kérem várjon...`
            });
            console.log(`MAINTENANCE {accessToken: ${agent.accessToken} agent: ${agent.agent.name}}: Logged out automatically because of reached timeout. Client (${affectedActiveClient.name}) has been passed to another agent.`);
        } else {
            console.log(`MAINTENANCE {accessToken: ${agent.accessToken} agent: ${agent.agent.name}}: Logged out automatically because of reached timeout.`);
        }
        sessions.agents.splice(sessions.agents.findIndex(e => e.accessToken === agent.accessToken), 1);
    }

    for (let client of inactiveClients) {
        client.status = Status.CANCELLED;
        client.conversation.push({
            ts: new Date().format("yyyy-mm-dd HH:MM:ss"),
            sender: 'SYSTEM',
            message: `Az ügyféllel a kapcsolat megszakadt. Az ügyintézés eredménye: ügyintézés meghiúsult. `
        });
        console.log(`MAINTENANCE {accessToken: ${client.accessToken} client: ${client.name}}: Logged out automatically because of reached timeout. Case has been closed as 'CANCELLED' result.`);
    }


    sessions.agents.forEach(agent => {
        let inLineWithClient = sessions.clients.filter(e => e.agentId === agent.agent.id && e.status === Status.IN_CONVERSATION).length !== 0;
        if (inLineWithClient) {
            agent.status = Status.IN_CONVERSATION;
        } else {
            agent.status = Status.WAITING;
        }
    });
}, 1000);