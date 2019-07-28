import { NextFunction, Request, Response, Send } from "express";
import { IncomingHttpHeaders } from "http";
import { HandshakeServer, SwishHeaders } from "swish-protocol";
const serverHS = new HandshakeServer();

function getSwishFromReqHeaders(reqHeaders: IncomingHttpHeaders): SwishHeaders {
	const headers: SwishHeaders = { swish_action: "", swish_iv: "", swish_key: "", swish_next: "", swish_sess_id: ""};
	if (typeof reqHeaders.swish_action === "string") {
		headers.swish_action = reqHeaders.swish_action;
	}
	if (typeof reqHeaders.swish_iv === "string") {
		headers.swish_iv = reqHeaders.swish_iv;
	}
	if (typeof reqHeaders.swish_key === "string") {
		headers.swish_key = reqHeaders.swish_key;
	}
	if (typeof reqHeaders.swish_next === "string") {
		headers.swish_next = reqHeaders.swish_next;
	}
	if (typeof reqHeaders.swish_sess_id === "string") {
		headers.swish_sess_id = reqHeaders.swish_sess_id;
	}
	return headers;
}

export function SwishServer(req: Request, res: Response, next: NextFunction) {
	const send = res.send;
	// modify the send command
	res.send = function SendOverride(body?: any): Response {
		if (body !== undefined) {
			body = "hello";
		}
		return send.call(this, body);
	};
	next();
}

export function SwishHandshakeListener(req: Request, res: Response, next: NextFunction) {
	const headers = getSwishFromReqHeaders(req.headers);
	if (req.method === "GET") {
		if (req.session === undefined) {
			throw new Error("req.session missing. use session middlewares like express-session");
		} else if (req.sessionID === undefined || req.sessionID === "") {
			throw new Error("req.sessionID missing. Please set this via genid for express-session");
		}
		headers.swish_sess_id = req.sessionID;
		const result = serverHS.handleHandshakeRequest(headers);
		req.session["decrypt"] = result.decrypt;
		res.set(result.headers);
		res.send(result.body);
	} else {
		console.log(req.method);
	}
	next();
}

export function SwishClient(req: Request, res: Response, next: NextFunction) {
	next();
}
