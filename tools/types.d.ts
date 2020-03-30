declare namespace Express {
  export interface Request {
    swish: {
      sessionId: string;
      nextPubKey: string;
      nextPrivate: string;
      createdDate: number;
    }
  }
  export interface Response {
    sendSwish(body: object): void;
  }
}