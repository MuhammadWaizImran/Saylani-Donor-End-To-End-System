import { Controller, Injectable, Get, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/reports/sponsorship/handler";

@Injectable()
export class ReportsSponsorshipService {
  get(request: Request) {
    return handlers.GET(request);
  }
}

@Controller("api/reports/sponsorship")
export class ReportsSponsorshipController {
  constructor(private readonly service: ReportsSponsorshipService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request));
  }
}
