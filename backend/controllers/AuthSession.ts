import { Controller, Injectable, Get, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/auth/session/handler";

@Injectable()
export class AuthSessionService {
  get(request: Request) {
    return handlers.GET(request);
  }
}

@Controller("api/auth/session")
export class AuthSessionController {
  constructor(private readonly service: AuthSessionService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request));
  }
}
