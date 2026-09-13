import { Controller, Injectable, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/auth/logout/handler";

@Injectable()
export class AuthLogoutService {
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/auth/logout")
export class AuthLogoutController {
  constructor(private readonly service: AuthLogoutService) {}
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
