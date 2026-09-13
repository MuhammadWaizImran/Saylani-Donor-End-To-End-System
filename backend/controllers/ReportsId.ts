import { Controller, Injectable, Get, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { bridge } from "../http/bridge";
import * as handlers from "../handlers/reports/[id]/handler";

@Injectable()
export class ReportsIdService {
  get(request: Request, id: string) {
    return handlers.GET(request, { params: Promise.resolve({ id }) });
  }
}

@Controller("api/reports/:id")
export class ReportsIdController {
  constructor(private readonly service: ReportsIdService) {}
  @Get()
  get(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return bridge(req, res, (request) => this.service.get(request, String(req.params.id)));
  }
}
