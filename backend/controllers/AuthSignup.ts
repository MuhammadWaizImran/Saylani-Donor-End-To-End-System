import { Controller, Injectable, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/auth/signup/handler";

@Injectable()
export class AuthSignupService {
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/auth/signup")
export class AuthSignupController {
  constructor(private readonly service: AuthSignupService) {}
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
