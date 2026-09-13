import { Controller, Injectable, Get, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/chat/conversations/handler";

@Injectable()
export class ChatConversationsService {
  get(request: Request) {
    return handlers.GET(request);
  }
}

@Controller("api/chat/conversations")
export class ChatConversationsController {
  constructor(private readonly service: ChatConversationsService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request));
  }
}
