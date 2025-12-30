import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to MODAKey E-Commerce API! Visit /api/docs for documentation.';
  }
}
