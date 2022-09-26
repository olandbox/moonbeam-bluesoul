import { AfterViewInit, Component, ElementRef, HostListener, Inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { HttpService } from 'src/app/service/http.service';
import {Clipboard} from '@angular/cdk/clipboard';
import { BaseData } from '../baseData';
import {CdkDragDrop, moveItemInArray, CdkDrag} from '@angular/cdk/drag-drop';
import { AlertService } from 'src/app/service/alert.service';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DeleteDialog } from '../../components/deleteDialog/delete-dialog';
import { UploadDialog } from '../../components/upload-dialog/upload-dialog';
import { MatTooltipDefaultOptions, MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { ShareDialog } from '../lands-footer/lands-footer.component';
import { FilesService } from 'src/app/service/files.service';
import { LinkDialog } from '../dialogs/link-dialog/link-dialog';
import { HttpParams } from '@angular/common/http';
import { ChainDialog } from '../dialogs/chain-dialog/chain-dialog';
import { ext } from 'src/app/constants/lands';

export interface DialogData {
  url: string;
}
interface ICommunity {
  id?: number;
  alias: string;
  logo: string;
  url: string;
  status?: number;
  sort?: number;
  type?: string;
  category?: string;
}
class Community {
  id: number;
  endId: number;
  alias: string;
  logo: string;
  url: string;
  status: number = 1;
  sort: number;
  type: string;
  category: string;
  aliasEditing: boolean = false;
  urlEditing: boolean = false;
  urlValid: boolean = true;
  swiped: boolean = false;
  constructor(data: ICommunity) {
    Object.assign(this, data);
  }
}

@Component({
  selector: 'app-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.less'],
})
export class CommunityComponent implements OnInit, OnChanges, OnDestroy {

  name: string;
  @Input() loader = false;
  @Input() suffix;
  @Input() edit: boolean;
  @Input() baseData: BaseData;
  @Input() language: string;


  defaultTouch = { x: 0, y: 0, time: 0 };

  communities: Community[] = null;
  communitiesShow: Community[] = null;
  isAdding: boolean = false;
  serviceCommunityListen: any;

  constructor(
    private router: Router,
    private modalService: NgbModal,
    private httpService: HttpService,
    private alertService: AlertService,
    private _matDialog: MatDialog,
    private filesService: FilesService
  ) { }

  ngOnInit(): void {
    this.serviceCommunityListen = this.httpService.communityListen.subscribe((data: any) => {
      if (data.value === 1) {
        this.add(data.type);

      }
    })
  }
  ngOnDestroy(): void {
    this.serviceCommunityListen.unsubscribe();
  }
  ngOnChanges(changes: SimpleChanges): void {

    if (changes.baseData?.currentValue || !changes.language.firstChange) {
      console.log(this.baseData.languages, this.language)
      if (!this.baseData.languages.includes(this.language) && this.edit) {
        this.createLandCommunites();
      } else {
        this.getLandCommunites()
      }
    }
  }

  ellipsisAddress(address) {
    if (address.length > 8) {
      return address.slice(0,4) + '...' + address.slice(-4)
    } else {
      return address
    }
  }

  createLandCommunites() {
    this.communities = null;
    this.communitiesShow = null;
    this.httpService.createLanguageLinksApi(this.baseData.id, this.language).subscribe(res => {
      this.baseData.languages.push(this.language)
      this.getLandCommunites()
    })
  }

  getLandCommunites() {
    this.communities = null;
    this.communitiesShow = null;
    let params = this.httpService.getLinksParams(this.baseData.id, this.language);
    this.httpService.getLandV2Api(params).subscribe(res => {
      if (!res.data) {
        this.communities = [];
        this.communitiesShow = [];
        this.httpService.emitData(true);
        return;
      }
      this.communities = [];
      res.data.forEach((element, i) => {
        let itemStatus;
        if (element[0].properties.hasOwnProperty('status')) {
          itemStatus = element[0].properties.status;
        } else {
          itemStatus = 1;
        }
        const params = {
          id: element[0].id,
          endId: element[0].endNodeId,
          alias: element[0].properties.alias,
          logo: element[0].properties.logo,
          url: element[0].properties.url,
          status: itemStatus,
          sort: element[0].properties.sort || res.data.length - i,
          type: element[0].properties.type || 'url',
          category: element[0].properties.category || element[0].properties.type
        }
        
        this.communities.push(new Community(params));
        this.validUrl(i);
      });
      this.communitiesShow = [];
      this.communitiesShow = this.communities.filter((element, i) => {
        return element.status == 1 && !this.validCommunity(i)
      })

      setTimeout(() => {
        this.httpService.emitData(true);
      });
    })

  }

  drop(event: CdkDragDrop<unknown>) {
    moveItemInArray(this.communities, event.previousIndex, event.currentIndex);
    this.communities.map((element:ICommunity, i:number) => {
      element.sort = this.communities.length - i;
    })
    let batch = [];
    this.communities.forEach((element:ICommunity) => {
      const item = {
        id: element.id,
        sort: element.sort
      }
      batch.push(item);
    })
    const matchQuery = this.httpService.updateLinkSort(batch);
    this.httpService.updateDatabase(matchQuery).subscribe(res => {
      if (res.length === this.communities.length) {
        this.alertService.create({
          body: 'The sequence has been adjusted successfully.',
          color: 'success',
          time: 2000
        })
      } else {
        this.alertService.create({
          body: 'Changing failed.',
          color: 'danger',
          time: 2000
        })
      }
    })
  }

  viewImage(url) {
    if (!url) return;
    this._matDialog.open(ZoomDialog, {
      panelClass: 'lands-zoom-dialog',
      width: '100vw',
      maxWidth: '100vw',
      height: '100vh',
      data: {url: url}
    })
  }

  changeImage(category, index) {
    if (category === 'image') {
      this.upload(index)
    } else {
      let dialog;
      if (category === 'url') {
        dialog = LinkDialog;
      } else if (category === 'wallet' || category === 'smartContract') {
        dialog = ChainDialog
      }
      const recommendDialog = this._matDialog.open(dialog, {
        panelClass: 'recommend-dialog',
        width: 'calc(100vw - 30px)',
        maxWidth: '1110px'
      })
      recommendDialog.afterClosed().subscribe(result => {
        if (result === undefined) {
          return;
        } else if (result === 'upload') {
          this.upload(index);
        } else {
          this.communities[index].logo = result.default.logo;
          this.communities[index].alias = this.communities[index].alias ? this.communities[index].alias : result.type
          this.communities[index].type = result.type;
          const propertyObj = {
            type: result.type,
            alias: this.communities[index].alias,
            url: this.communities[index].url,
            logo: result.default.logo,
            language: this.language,
            sort: this.communities[index].sort,
            status: this.communities[index].status,
            category: this.communities[index].category
          }
          this.httpService.updateLinkApi(this.communities[index].id, propertyObj).subscribe((res: any) => { 
            if (res.code === 0) {
              this.alertService.create({
                body: 'Changing successfully.',
                color: 'success',
                time: 2000
              });
              this.communities[index].id = res.data.relationship.id
            }
          })
        }

      })
    }
  }
  upload(index: number) {
    const uploadDialog = this._matDialog.open(UploadDialog, {
      panelClass: 'lands-add-dialog',
      width: 'calc(100vw - 30px)',
      maxWidth: '1110px'
    })
    uploadDialog.componentInstance.urlEvent.subscribe((url: string) => {
      this.communities[index].logo = url;
        const propertyObj = {
        type: this.communities[index].type,
        category: this.communities[index].category,
        alias: this.communities[index].alias,
        url: this.communities[index].url,
        logo: this.communities[index].logo,
        language: this.language,
        sort: this.communities[index].sort,
        status: this.communities[index].status
      }
      this.httpService.updateLinkApi(this.communities[index].id, propertyObj).subscribe((res: any) => {
        if (res.code === 0) {
          this.alertService.create({
            body: 'Changing successfully.',
            color: 'success',
            time: 2000
          })
          this.communities[index].id = res.data.relationship.id
        }
      })
    })
  }

  validUrl(index) {
    if (this.communities[index].category === 'url') {
      let r = new RegExp('^((https|http):\/\/)')
      if (!!this.communities[index].url && !r.test(this.communities[index].url)) {
        this.communities[index].urlValid = false;
      } else {
        this.communities[index].urlValid = true;
      }
    } else {
      this.communities[index].urlValid = true;
    }
  }

  focusProperty(index: number, propertyName: string) {
    this.communities[index][propertyName + 'Editing'] = true;
  }
  blurProperty(index: number, propertyName: string) {
    if (propertyName === 'url') {
      this.validUrl(index);
    }


    this.communities[index][propertyName + 'Editing'] = false;
    const propertyObj = {
      type: this.communities[index].type,
      category: this.communities[index].category,
      alias: this.communities[index].alias || '',
      url: this.communities[index].url || '',
      logo: this.communities[index].logo || '',
      language: this.language,
      sort: this.communities[index].sort,
      status: this.communities[index].status
    }
    this.httpService.updateLinkApi(this.communities[index].id, propertyObj).subscribe((res: any) => {
      if (res.code === 0) {
        this.alertService.create({
          body: 'Changing successfully.',
          color: 'success',
          time: 2000
        })
        this.communities[index].id = res.data.relationship.id
      }
    })
  }

  validCommunity(i) {
    if (this.communities[i].category === 'text') {
      if (this.communities[i].alias == '' || this.communities[i].url == '') {
        return true;
      } else {
        return false;
      }
    }
    else if (this.communities[i].category === 'image') {
      if (this.communities[i].alias == '') {
        return true;
      } else {
        return false;
      }
    }
    else if (this.communities[i].category === 'wallet' || this.communities[i].category === 'smartContract') {
      if (this.communities[i].alias == '' || this.communities[i].url == '') {
        return true;
      } else {
        return false;
      }
    }
    else {
      let r = new RegExp('^((https|http):\/\/)')
      if (this.communities[i].alias == '' || this.communities[i].url == '' || !r.test(this.communities[i].url)) {
        return true;
      } else {
        return false;
      }
    }
  }

  changeCommunityStatud(e, index: number) {
    this.communities[index].status = e.currentTarget.checked;
    const status = e.currentTarget.checked ? 1 : 0;
    const matchQuery = this.httpService.updateLink(this.communities[index].id, 'status', status);
    this.httpService.updateDatabase(matchQuery).subscribe(res => {
      if (res.length > 0) {
        this.alertService.create({
          body: status ? 'Allowed to display on Profile.' : 'Prohibited from displaying on Profile.',
          color: 'success',
          time: 2000
        })
      } else {
        this.alertService.create({
          body: 'Changing failed.',
          time: 2000,
          color: 'danger'
        })
      }
    })
  }

  delete(index: number) {
    const deleteDialog = this._matDialog.open(DeleteDialog, {
      panelClass: 'lands-add-dialog',
      width: 'calc(100vw - 30px)',
      maxWidth: '1110px'
    })
    deleteDialog.afterClosed().subscribe(result => {
      if (result) {
        this.httpService.deleteLinkApi(this.communities[index].id).subscribe(res => {
          if (res) {
            this.communities.splice(index, 1)
          }
        })
      }
    })
  }

  add (category: string) {
    let maxSort = 0;
    this.communities.forEach(item => {
      if (item.sort > maxSort) {
        maxSort = item.sort + 1
      }
    })
    let propertyObj = {
      category: category,
      alias: '',
      url: '',
      logo: '',
      language: this.language,
      sort: maxSort,
      status: 1,
      type: category
    }
    this.httpService.createLinkApi(this.baseData.id, propertyObj).subscribe((data: any) => {
      if (!data) {
        this.httpService.emitCommunity(0, '');
        return;
      };
      const params = {
        id: data.relationship.id,
        endId: data.relationship.endNodeId,
        alias: data.relationship.properties.alias,
        logo: data.relationship.properties.logo,
        url: data.relationship.properties.url,
        status: data.relationship.properties.status,
        sort: data.relationship.properties.sort,
        type: data.relationship.properties.type,
        category: data.relationship.properties.category
      }
      this.communities.unshift(new Community(params));
      this.httpService.emitCommunity(0, '');
    });
  }


  download(url, alias) {
    const index = url.lastIndexOf(".");
    const suffix = url.substr(index + 1);

    this.filesService.getBase64ImageFromURL(url).subscribe(base64data => {

      const base64Image = `data:image/${suffix};base64,${base64data}`;

      // save image to disk
      var link = document.createElement("a");
      document.body.appendChild(link); // for Firefox

      link.setAttribute("href", base64Image);
      link.setAttribute("download", `${alias}.${suffix}`);
      link.click();
    })
  }
  copy(e) {
    e.show()
    setTimeout(()=>{e.hide()}, 1000)
  }
  share(url) {
    const addRef = this._matDialog.open(ShareDialog, {
      panelClass: 'recommend-dialog',
      width: 'calc(100vw - 30px)',
      maxWidth: '1110px',
      data: {
        url: url
      }
    })
  }

  touchStart(event) {
    const touchObj = event.changedTouches[0];
    this.defaultTouch.x = touchObj.pageX;
    this.defaultTouch.y = touchObj.pageY;
    this.defaultTouch.time = event.timeStamp;
  }

  touchEnd(event, index) {
    const touchObj = event.changedTouches[0];
    const distX = touchObj.pageX - this.defaultTouch.x;
    const distY = touchObj.pageY - this.defaultTouch.y;
    if (Math.abs(distX) > 10) {
      if (distX < 0) {
        // left
        this.communitiesShow.forEach((element, i) => {
          element.swiped = i === index ? true : false;
        })
      } else {
        this.communitiesShow[index].swiped = false;
      }
    }
  }


}




@Component({
  selector: 'zoom-dialog',
  templateUrl: 'zoom-dialog.html',
})
export class ZoomDialog {
  constructor(
    public dialogRef: MatDialogRef<ZoomDialog>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  close() {
    this.dialogRef.close()
  }

}
