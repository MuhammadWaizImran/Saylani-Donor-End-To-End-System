import { Controller, Injectable, Get, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/chat/conversations/[id]/handler";

@Injectable()
export class ChatConversationsIdService {
  get(request: Request, id: string) {
    return handlers.GET(request, { params: Promise.resolve({ id }) });
  }
}

@Controller("api/chat/conversations/:id")
export class ChatConversationsIdController {
  constructor(private readonly service: ChatConversationsIdService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request, String(req.params.id)));
  }
}
