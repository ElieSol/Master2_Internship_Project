/*
  Script to render the timeline tab page
*/
import * as React from 'react';
import {ClinicalEvent, ClinicalEventData} from "../../../shared/api/generated/CBioPortalAPI";
import {Mutation} from "../../../shared/api/generated/CBioPortalAPI";
import Grid from 'react-bootstrap/lib/Grid';
import Col from 'react-bootstrap/lib/Col';
import 'bootstrap/dist/css/bootstrap.css';
import './TPStyle.css'
import "react-select/dist/react-select.css";
import _ from 'lodash';

import {TPPlotN} from './TPPlotN';
import {TPUI} from './TPUI';
import { PatientViewPageStore } from '../clinicalInformation/PatientViewPageStore';
import { TPLegend } from './TPLegend';

import {SketchPicker} from 'react-color';
import { any } from 'prop-types';

export type MutationFrequencies = number[];

export type MutationFrequenciesBySample = { [sampleId:string]: MutationFrequencies  }

export type TimePointOverviewProps = {
    store: PatientViewPageStore;
    mergedMutations: Mutation[][];
    sampleOrder: {[s:string]:number};
    data?: MutationFrequenciesBySample;
    width?: number;
}

export type TimePointOverviewState = {
    multiValue:[],
    inputs: [],
    data: MutationFrequenciesBySample,
    dataSets:[{}],
    dataSetsToRender:[{}],
    color:any,
}

let source:any;



export class TimePointOverview extends React.Component<TimePointOverviewProps,TimePointOverviewState> {

    /*
    shouldComponentUpdate(nextProps:TimePointOverviewProps){
        // only rerender to resize
        return nextProps.containerWidth !== this.props.containerWidth;
    }
    */


    constructor(props:TimePointOverviewProps) {
        super(props);

        this.state = {
            multiValue:[],
            inputs: [],
            data: {},
            dataSets: [{}],
            dataSetsToRender:[{}],
            color: any,
          };

          this.updateDataSets = this.updateDataSets.bind(this);
    }

    public static defaultProps = {
        data: {},
        dataSets: [],
        dataSetsToRender:[],
        width: window.innerWidth + "px",
        height: window.innerHeight + "px"
    }
    
    inputData = (datas:[]) => {
        console.log("Input check");
        console.log("Datas input = "+datas.values);
        if(datas.length!=this.state.inputs.length){
            this.setState({inputs: datas})
        }
    }

    reinitializeDataSetsToRender(){
        this.setState({dataSetsToRender: [{}]});
      }
  
    updateDataSets(){
        if(this.state.inputs.length!=0){
            let current_datasetToRender = this.state.dataSetsToRender;
            let current_dataset = this.state.dataSets;
            for(let val in this.state.inputs){
                let current_choice = this.state.inputs[val];
                current_dataset.push(current_choice);
                console.log("Current choices = "+current_choice);
            }
            for(let dataset in current_datasetToRender){
              if(current_dataset.includes(current_datasetToRender[dataset])==false){
                current_dataset.push(current_datasetToRender[dataset]);
              }
            }
            this.setState({dataSets: current_dataset})
        }
        
        
    }

    updateListOfColorUsed(listOfColorsUsed:any){
        this.setState(listOfColorsUsed)
    }

    // Getter

    private getListOfGenes(mergedMutations: Mutation[][]){
        let geneList = [];
        let gene;
  
        for(const mutations of mergedMutations){
          for(const mutation of mutations){
            gene = mutation.gene;
            if(this.checkListContent(geneList, gene.hugoGeneSymbol)===false){
              geneList.push(gene.hugoGeneSymbol);
            }
          }
        }
        return geneList;
      }
  
      private getListOfGenesFilteredVersion(mergedMutations: Mutation[][]){
        let geneList = [];
        let geneList_cp = [];
        let gene;
  
        for(const mutations of mergedMutations){
          for(const mutation of mutations){
            gene = mutation.gene;
            if(this.checkListContent(geneList_cp, gene.hugoGeneSymbol)===false){
              geneList.push({value: gene.hugoGeneSymbol, label: gene.hugoGeneSymbol});
              geneList_cp.push(gene.hugoGeneSymbol);
            } 
          }
        }
        geneList = geneList.sort();
        return geneList;
      }
  
      private getListOfFBySampleForOneGeneWithRef(choice:string, mergedMutations: Mutation[][]){
        let array = this.getSortedGeneFrequencyBySampleArray(mergedMutations);
        let output_dict:any ={};
        let output_list:any = [];
  
  
        for(let elt in array){
          let current_element = array[elt];
          if((current_element['GENE_ID'].localeCompare(choice))===0){
            output_dict[current_element['SAMPLE_ID']]=current_element['FREQ'];
          }
        }
        output_list.push(choice);
        output_list.push(output_dict);
        return output_list;
      }
  
  
      private getListOfFBySampleForOneGene(choice:string, mergedMutations: Mutation[][]){
        let list_input = this.getListOfFBySampleForOneGeneWithRef(choice, mergedMutations);
        return list_input[1];
      }
  
      
      private getSortedGeneFrequencyBySampleArray(mergedMutations: Mutation[][]){
        let geneFrequencyBySampleID = [];
  
        let sampleID;
        let gene;
        let frequency;
  
        for (const mutations of mergedMutations) {
          for (const mutation of mutations) {
              if (mutation.tumorAltCount >= 0 && mutation.tumorRefCount >= 0) {
                  let dict : any = {};           
                  sampleID = mutation.sampleId;
                  gene = mutation.gene;
                  frequency = mutation.tumorAltCount / (mutation.tumorRefCount + mutation.tumorAltCount);
                  dict['GENE_ID']=gene.hugoGeneSymbol;
                  dict['SAMPLE_ID']=sampleID;
                  dict['FREQ']=frequency;
                  geneFrequencyBySampleID.push(dict);
              }
          }
        }
        return geneFrequencyBySampleID;
      }
  
      private svgContainer: HTMLDivElement;
    
     
  
      /*
       Computational function
      */
      private computeMutationFrequencyBySample(mergedMutations:Mutation[][]):MutationFrequenciesBySample {
        const ret:MutationFrequenciesBySample = {};
        let sampleId;
        let freq;
        
        for (const mutations of mergedMutations) {
            for (const mutation of mutations) {
                if (mutation.tumorAltCount >= 0 && mutation.tumorRefCount >= 0) {
                    sampleId = mutation.sampleId;
                    freq = mutation.tumorAltCount / (mutation.tumorRefCount + mutation.tumorAltCount);
                    ret[sampleId] = ret[sampleId] || [];
                    ret[sampleId].push(freq);
                }
            }
        }
        for (const sampleId of Object.keys(this.props.sampleOrder)) {
            ret[sampleId] = ret[sampleId] || [];
            const shouldAdd = mergedMutations.length - ret[sampleId].length;
            for (let i=0; i<shouldAdd; i++) {
                ret[sampleId].push(NaN);
            }
        }
        let i = 0;
        for(const key of Object.keys(ret)){
            let sum = 0;
            for(const value of ret[key]){
                sum += value
            }
            i+=1;
        }
        return ret;
    }
      
      private computeMeanOfMutationFrequencies(){
        const inputData = this.computeMutationFrequencyBySample(this.props.mergedMutations);
        const outputData:any = {};
        for(const key of Object.keys(inputData)){
            let sum = 0;
            let total = 0;
            let i = 0;
            for(const value of inputData[key]){
                if(isNaN(value)!= true){
                    sum += value;
                    i += 1;
                }
            }
            total=sum/(i);
            outputData[key]=total;
        }
        return outputData;
    }
  
    private computeMedianOfMutationFrequencies(){
      const inputData = this.computeMutationFrequencyBySample(this.props.mergedMutations);
      const outputData:any = {};
      for(const key of Object.keys(inputData)){
        let median=0;
        inputData[key] = inputData[key].filter(value => !Number.isNaN(value)) ;
        let SortedList = inputData[key].sort((n1,n2)=>n1-n2);
        let ListLength = SortedList.length;
        if(ListLength%2==0){
          median = ((SortedList[Math.round((ListLength-1)/2)]+SortedList[Math.round((ListLength/2))])/2);
        }
        else{
          median = SortedList[Math.round(ListLength/2)];
        }
        outputData[key]=median;
      }
      return outputData;
    }
  
    /*
      Utility Methods
    */
  
    private setColor(listColorUsed:any =[]){
      let listColor:any =["Pink", "Grey", "Violet", "Red", "Orange", "Yellow", "Brown", "Black"];
      for(let el in listColor){
        if(listColorUsed.includes(listColor[el])){
          listColor.splice(el, 1);
        }
      }
      let randomPick = Math.floor(Math.random()*listColor.length)+1;
      for(let col in listColorUsed){
        if(listColorUsed[col]===listColor[randomPick]){
          listColorUsed.splice(col, 1);
          this.updateListOfColorUsed(listColorUsed);
        }
      }
      return listColor[randomPick];
    }
    
    private checkListContent(list:string[], element:string){
      let elt:string;
      for(elt in list){
        if((list[elt].localeCompare(element))===0){
          return true;
        } 
      }
      return false;
    }
  
    public formatDataForVictoryChart(inputlist:any){
      let outputlist:any=[];
      let listOfDates = this.getListOfDates(this.props.mergedMutations);
      let cpt=0;
      for(let value in inputlist){
        //console.log("KEY = "+value+"_ VALUE = "+inputlist[value]);
        //outputlist.push({a: value, b:inputlist[value]});
        outputlist.push({a: listOfDates[cpt], b:inputlist[value]});
        cpt+=1;
      }
      return outputlist;
    }
  
    private getDataForLegendDisplay(datasets:any){
     let data_list: any = [];
      for(let datas in datasets){ 
        let dict: any = {};
        dict['label']=datasets[datas][0];
        let dictOfdict:any = dict['symbol']={};
        dictOfdict['fill']=datasets[datas][2];
        dict['name']=datasets[datas][0];
        data_list.push(dict);
      }
      return data_list;
    }

    private getMaxValue(inputlist:any){
      let max = 0;
      for(let val in inputlist){
        if(inputlist[val]>max){
          max = inputlist[val];
        }
      }
      return max;
    }

     /*
        DATE / TIMELINE MANAGEMENT
    */

   private getListOfDates(mergedMutations: Mutation[][]){
    let listOfDates:any=[];

    let timelineData = this.props.store.clinicalEvents.result.map((eventData:ClinicalEvent) => {
      listOfDates.push(eventData.startNumberOfDaysSinceDiagnosis);
    });

    /*this.props.store.clinicalEvents.result.map((event: ClinicalEvent)=>{
      console.log("EVENT DT = "+event.attributes+"_"+event.uniqueSampleKey);
      let i = 0;
      for(let elt in event.attributes){
        console.log("___________________________________________");
        console.log("CT OF ATTRIBUTE = "+event.attributes[elt]);
        let value:any=event.attributes[elt];
        for(let v in value){
          console.log("CT OF VAL = "+value[v]);
        }
      }
      }
    )*/
    if(listOfDates.length==0){
      let list_date_toConvert:any = [];
      for (const mutations of mergedMutations) {
        for (const mutation of mutations) {
          let date = this.getDateFromSampleID(mutation.sampleId);
          if(list_date_toConvert.includes(date)==false){
            list_date_toConvert.push(date);
          }
        }
      }
      listOfDates=this.computeStartDateOfEachSamples(list_date_toConvert);
      let finalList:any =[];
      for(let elt in listOfDates){
        finalList.push(listOfDates[elt][1]);
      }
      return finalList;
    }
    else{
      return listOfDates;
    }
  }

    private getListOfDateBySamples(mergedMutations: Mutation[][]){
      let listOfDates:any=[];
      let listOfSampleID:any=[];
      let listOfDateBySamples:any=[]

      let timelineData = this.props.store.clinicalEvents.result.map((eventData:ClinicalEvent) => {
        listOfDates.push(eventData.startNumberOfDaysSinceDiagnosis);
        if(eventData.attributes[1]!=undefined){
          if(eventData.attributes[1].key=="SAMPLE_ID"&&listOfSampleID.includes(eventData.attributes[1].value)==false){
            listOfSampleID.push(eventData.attributes[1].value);
          }
        }
      });

      console.log("L SAMPLEID = "+listOfSampleID.length);

      if(listOfDates.length==0){
        let list_date_toConvert:any = [];
        for (const mutations of mergedMutations) {
          for (const mutation of mutations) {
            let date = this.getDateFromSampleID(mutation.sampleId);
            if(list_date_toConvert.includes(date)==false){
              list_date_toConvert.push(date);
            }
            if(listOfSampleID.includes(mutation.sampleId)==false){
              listOfSampleID.push(mutation.sampleId);
            }
          }
        }


        listOfDates=this.computeStartDateOfEachSamples(list_date_toConvert);
        let cpt = 0;

        for(let id in listOfSampleID){
          let list = [];
          list.push(listOfSampleID[id]);
          let date = this.compareIDToDate(listOfDates, listOfSampleID[id]);
          list.push(date);
          listOfDateBySamples.push(list);
          cpt+=1;
        }
        return listOfDateBySamples;
      }

      else{
        let cpt = 0;

        for(let id in listOfSampleID){
          let list = [];
          list.push(listOfSampleID[id]);
          list.push(listOfDates[cpt]);
          listOfDateBySamples.push(list);
          cpt+=1;
        }
        return listOfDateBySamples;
      }
        
    }

    private compareIDToDate(listOfDates:any, sampleID:any){
      let dateV1 = this.getDateFromSampleID(sampleID);
      let dateV2 = this.convertToDateFormat(dateV1);
      for(let date in listOfDates){
        console.log("A = "+listOfDates[date][0]);
        console.log("B = "+dateV2);
        if(listOfDates[date][0]===dateV2){
          console.log("ID = "+sampleID+"_DATE = "+listOfDates[date][0]);
          return listOfDates[date][1];
        }
      }
    }

  /* MT TO EXTRACT FROM LB SAMPLEID A RAW DATE FORMAT
     ________________________________________________
     Return: DDMMYY
  */
  private getDateFromSampleID(sampleID: any){
    let listOfMatch = sampleID.match(/_[0-9]*_/);
    if(listOfMatch!=null){
      let match = listOfMatch[0].match(/\d{6}/);
      if(match!=null){
        return match[0];
      }
    }
  }

  /* MT COMPUTING START DATE FROM LIST
    ____________________________________
    Return: [[date0, interval0], etc...]
  */
  private computeStartDateOfEachSamples(listOfDates: any){
    let arrayOfDate: any = [];
    let listOfStartDate: any = [];
    for(let date of listOfDates){
      arrayOfDate.push(this.convertToDateFormat(date));
    }
    let i = 0;
    let sortedDateArray = arrayOfDate.sort((a:any,b:any)=>a-b);
    let firstDate = sortedDateArray[0];
    for(let el in arrayOfDate){
      if(i==0){
        let list=[]
        listOfStartDate.push(arrayOfDate[el],0)
        //listOfStartDate.push(0);
        i+=1
      }
      else{
        let list=[]
        list.push(arrayOfDate[el], this.dateDifference(firstDate, arrayOfDate[el]))
        listOfStartDate.push(list);
      }
    }
    return listOfStartDate;
  }

  /* MT CONVERT RAW DATE FORMAT TO OFFICIAL DATE FORMAT
    ___________________________________________________
    Return: Date(YY,MM,DD) 
  */
  private convertToDateFormat(date: any){
    let day = date.slice(0,2);
    let month = parseInt(date.slice(2,4))-1;
    let year = 20+date.slice(4,7);
    let convertedDate = new Date(year, month, day);
    return convertedDate;
  }

  /* COMPUTE THE DIFF BTW 2 DATES
     ____________________________
     Return: number (in DAYS)
  */
  private dateDifference(d1:any,d2:any){
    var WNbJours = d2.getTime() - d1.getTime();
    return Math.ceil(WNbJours/(1000*60*60*24));
  }

    

    // RENDERING OF THE PAGE
    public render() {
        this.inputData;
        
        return(
            <div>
                <TPPlotN
                    data={this.formatDataForVictoryChart(this.computeMedianOfMutationFrequencies())}
                    width={this.props.width}
                    maxValue={this.getMaxValue(this.getListOfDates(this.props.mergedMutations))}
                />

                <hr/>

                <TPUI
                    data={this.getListOfGenesFilteredVersion(this.props.mergedMutations)}
                    inputData={this.inputData}
                />

                <hr/>

                <TPLegend
                    data={this.formatDataForVictoryChart(this.computeMedianOfMutationFrequencies())}
                />
                
                <hr/>
   

            </div>
        )
        
    }

    

}
