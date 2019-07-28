import { default as bodyParser } from "body-parser";
import { default as express } from "express";
import { default as session } from "express-session";
import { v4 as uuidv4 } from "uuid";

import { SwishHandshakeListener, SwishServer } from "./../src/index";

const port = 3000;
const app = express();
app.use(bodyParser.json());
app.set("trust proxy", 1); // trust first proxy
app.use(session({
	genid: (req) => uuidv4(), // use UUIDs for session IDs
	resave: false,
	saveUninitialized: true,
	secret: "keyboard cat",
}));
app.use(SwishServer);
app.get("/auth/swish/handshake", SwishHandshakeListener);

app.get("/foo", (req, res, next) => {
	console.log("foo called");
	if (req.session != undefined && req.session["views"] != undefined) {
		res.send(`you viewed this page ${req.session["views"]["/foo"]} times`);
	} else {
		res.send("OMG!");
	}
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
