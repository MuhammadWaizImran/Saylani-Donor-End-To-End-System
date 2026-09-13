import { Controller, Injectable, Post, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/voice/tts/handler";

@Injectable()
export class VoiceTtsService {
  post(request: Request) {
    return handlers.POST(request);
  }
}

@Controller("api/voice/tts")
export class VoiceTtsController {
  constructor(private readonly service: VoiceTtsService) {}
  @Post()
  post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.post(request));
  }
}
