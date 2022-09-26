import { NgModule } from '@angular/core';

import { IsFinitePipe } from "./isFinit.pipe";
import { TimeSincePipe } from './time.pipe';

@NgModule({
    imports: [
      // dep modules
    ],
    declarations: [ 
        IsFinitePipe,
        TimeSincePipe
    ],
    exports: [
        IsFinitePipe,
        TimeSincePipe
    ]
  })
  export class AppPipesModule {}