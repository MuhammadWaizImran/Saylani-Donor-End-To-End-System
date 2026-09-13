import { Controller, Injectable, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/chat/handler";

@Injectable()
export class ChatService {
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/chat")
export class ChatController {
  constructor(private readonly service: ChatService) {}
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
