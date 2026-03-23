import { WebSocketServer } from "ws"

const wss = new WebSocketServer({
    port: 8081
});

wss.on("connection", (conn) => {
    for (var i = 0; i < 100; i++) {
        conn.send(i);

        console.log(i, Date.now());
    }

    conn.on("error", (...args) => console.log("ERROR", ...args));
    conn.on("close", () => console.log("CLOSE"));
});