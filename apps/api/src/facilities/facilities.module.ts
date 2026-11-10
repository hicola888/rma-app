import { Module } from '@nestjs/common';
import {
  LocationsController,
  StaffController,
  WarehousesController,
} from './facilities.controller.js';
import { LocationTransferController, WarehouseTransferController } from './transfer.controller.js';

@Module({
  controllers: [
    WarehouseTransferController,
    LocationTransferController,
    WarehousesController,
    LocationsController,
    StaffController,
  ],
})
export class FacilitiesModule {}
