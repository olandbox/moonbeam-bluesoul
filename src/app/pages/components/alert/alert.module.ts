import { NgModule } from "@angular/core";
import { CommonModule } from '@angular/common';
import { AlertComponent } from './alert.component';
import { AlertService } from "src/app/service/alert.service";

@NgModule({
    imports: [
      CommonModule
    ],
    declarations: [AlertComponent],
    exports: [AlertComponent], //this is  very important
    providers: [AlertService]
  
  })
  export class AlertModule { }