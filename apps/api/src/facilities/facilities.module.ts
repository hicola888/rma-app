import { Module } from '@nestjs/common';
import {
  LocationsController,
  StaffController,
  WarehousesController,
} from './facilities.controller.js';

@Module({
  controllers: [WarehousesController, LocationsController, StaffController],
})
export class FacilitiesModule {}
