/*
  Script to render the timeline graph
*/
import * as React from 'react';
import ReactDom from 'react-dom';
import Select from 'react-select';
import {createContainer, VictoryLabel, VictoryGroup, VictoryTooltip, VictoryVoronoiContainer, VictoryLegend, VictoryTheme, VictoryScatter, VictoryChart, VictoryLine, VictoryAxis, VictoryBrushContainer} from 'victory';
import {Mutation} from "../../../shared/api/generated/CBioPortalAPI";
import Grid from 'react-bootstrap/lib/Grid';
import Col from 'react-bootstrap/lib/Col';
import {Panel, Modal, Table} from 'react-bootstrap/lib';
import 'bootstrap/dist/css/bootstrap.css';
import DownloadControls from "../../../shared/components/downloadControls/DownloadControls";
import autobind from 'autobind-decorator';
import "react-select/dist/react-select.css";
import _ from 'lodash';
import { Next } from 'react-bootstrap/lib/Pagination';
import {Row, Button} from 'react-bootstrap';
import Slider, {createSliderWithTooltip, Range} from "rc-slider";
import {ICosmicData} from "shared/model/Cosmic";
import "react-bootstrap-table/dist/react-bootstrap-table-all.min.css";

import {ClinicalEvent, ClinicalEventData} from "../../../shared/api/generated/CBioPortalAPI";
import { PatientViewPageStore } from '../clinicalInformation/PatientViewPageStore';
import {saveSvgAsPng} from 'save-svg-as-png';
import { observable } from 'mobx';

import {SketchPicker, SliderPicker} from 'react-color';

import {MutationMatrix, getCorrelatedMutations} from './MutMatrix/MutationMatrix';
import 'rc-slider/assets/index.css';

import {BootstrapTable, TableHeaderColumn} from 'react-bootstrap-table';
import { timeSaturday } from 'd3-time';

const style = require("./TPStyle.css");

const SVG_ID = "plots-tab-plot-svg";

function log(value:any){
  console.log(value); // eslint-disable-line
}

export type MutationFrequencies = number[];

export type MutationFrequenciesBySample = { [sampleId:string]: MutationFrequencies  }

export type TPPlotProps = {
    store:PatientViewPageStore;
    mergedMutations: Mutation[][];
    sampleOrder: {[s:string]:number};
    data?: MutationFrequenciesBySample;
    width?: number;
    cosmicData?:ICosmicData;
}

export type TPPState = {
    multiValue:[],
    filterOptions: any,
    data: MutationFrequenciesBySample;
    dataSets:[{}];
    dataSetsToRender:[[{}]];
    zoomDomain: any;
    zoomDomainY: any;
    chartModifications: any;
    choices: string[];
    stateButtonCp1: boolean;
    stateButtonCp2: boolean;
    stateButtonCp3: boolean;
    stateButtonCp4: boolean;
    stateButtonCp5: boolean;
    listOfDates: any;
    color: any;
    infoToDisplay: any;
    listOfInfo: any;
    show: boolean;
    showCMData: any;
    showMutLine: any;
    hoveredData:any;
    displayLineRep:boolean;
    listOfStartDate: any;
}

let source:any;

// Class Definition

export class TPPlot extends React.Component<TPPlotProps, TPPState>{
    @observable plotExists = false;
    private currentWidth:number;
    containerRef: any;

    public constructor(props: TPPlotProps) {
        super(props);

        this.state = {
          multiValue:[],
          filterOptions: this.getListOfGenesFilteredVersion(props.mergedMutations),
          data: {},
          dataSets: [{}],
          dataSetsToRender:[[{}]],
          zoomDomain: { x: [1,5] },
          zoomDomainY: {y: [0,1]},
          chartModifications:undefined,
          choices: [],
          stateButtonCp1: false,
          stateButtonCp2: false,
          stateButtonCp3: false,
          stateButtonCp4: false,
          stateButtonCp5: false,
          listOfDates: this.getListOfDates_bis(props.mergedMutations),
          color: "#0080ff",
          infoToDisplay: [],
          listOfInfo: [],
          show: false,
          showCMData: [],
          showMutLine: [],
          hoveredData: "",
          displayLineRep:true,
          listOfStartDate: this.getListOfDates(props.mergedMutations),
        };
        this.handleMultiChange = this.handleMultiChange.bind(this);
        this.currentWidth = window.innerWidth;
        this.logContainerRef = this.logContainerRef.bind(this);
        this.handleShow = this.handleShow.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    public static defaultProps = {
      data: {},
      dataSets: [],
      dataSetsToRender:[],
      width: window.innerWidth + "px",
      height: window.innerHeight + "px"
    }

    /*
        CORRELATED MUTATION TABLE
    */

    
    isExpandableRow(row:any){
      if(row.nb<15){return true;}
      else{return false;}
    }

    expandComponent(row:any, rowIndex:any){
      onlyOneExpanding: true;
      return(
        <div>
          <VictoryChart
            padding={{ top: 10, left: 10, right: 10, bottom: 10 }}
            width={100}
            height={50}
          >
            <VictoryAxis
              orientation="left"
              tickFormat = {()=>``}
              style={{
                axis: {stroke: "grey"}
              }}
            />

            <VictoryAxis
              orientation="bottom"
              tickFormat = {()=>``}
              style={{
                axis: {stroke: "grey"}
              }}
            />
            <VictoryGroup 
              data={this.getDataTableGraph(row.gA, row.PosA)} 
              x="a" 
              y="b" 
              color="green">
              <VictoryLine/>
              <VictoryScatter
                size={2}
              />
            </VictoryGroup>
            <VictoryGroup 
              data={this.getDataTableGraph(row.gB, row.PosB)} 
              x="a" 
              y="b" 
              color="blue">
              <VictoryLine/>
              <VictoryScatter
                size={2}
              />
            </VictoryGroup>
          </VictoryChart>
        </div>)
    }

    private getDataTableGraph(geneA:any, posA:any){
      let tpA:any, formattedTpA:any=[];
      tpA = this.getAllPointsForOneMutationOfOneGeneByPos(geneA, posA);
      let listKey = Object.keys(tpA);
      for(let el in tpA){
        formattedTpA.push({a: Number(el), b:tpA[el]});
      }
      return formattedTpA;
    }
  

    /*
        COMPONENT STATE MANAGEMENT
    */

    componentDidMount() {      
      this.logContainerRef();
      this.setState({listOfInfo: this.getAllMutationsInfo(this.props.mergedMutations)})
    }

    componentDidUpdate() {
      this.plotExists = !!this.getSvg();
    }


    /*
        PROPS STATE MANAGEMENT
    */


    // MT THAT CONTAINS THE REF OF THE GRAPH
    logContainerRef() {
      console.log(this.containerRef);
    };

    // MT TO MANAGE THE ZOOM
    handleZoom(domain: any) {
        this.setState({ zoomDomain: domain });
    }

    // MT TO MANAGE THE ZOOM
    handleZoomY(domain: any) {
      this.setState({ zoomDomainY: domain });
    }

    // MT TO MANAGE THE DISPLAY OF THE MutMatrix MODAL
    handleShow(){
      this.setState({ show: true});
    }

    handleClose(){
      this.setState({ show: false});
    }

    showLineRep(){
      this.setState({displayLineRep:true})
    }

    hideLineRep(){
      this.setState({displayLineRep:false})
    }


    /* MT TO MANAGE THE USER INPUT ON THE DROPDOWN-SELECTION
       _____________________________________________________
       Return: multiValue, dataSets, dataSetsToRender, choices
    */
    handleMultiChange (multiValue: any) {
      let current_datasetToRender = this.state.dataSetsToRender;
      console.log("Current dataset to render = "+current_datasetToRender);
      if(multiValue[0]!=null && multiValue.length<=5){
        let current_dataset = this.state.dataSets;
        let i = 0;
        for(let val in multiValue){
          let current_choice = multiValue[val].value;
          let list = this.getListOfFBySampleForOneGeneMutWithRef(current_choice, this.props.mergedMutations);
          let choices = this.state.choices; 
          
          if(choices.includes(current_choice)===false){
              current_datasetToRender.push(list);
              choices.push(current_choice);
            }
          
          i+=1;
        }
        this.setState( () =>{ 
          return {
            multiValue,
            dataSets: this.state.dataSets,
            dataSetsToRender: this.state.dataSetsToRender,
            choices: this.state.choices
          };
        });
      }
      
      let idx = 0;
      for(let elt in current_datasetToRender){
        let current_list = current_datasetToRender[elt];
        let current_choice = current_list[0];
        if(this.checkDatasetToRenderContent(current_choice, multiValue)==false){
          current_datasetToRender.splice(idx, 1);
          let jdx = 0;
          for(let elt in this.state.choices){
            if(this.state.choices[elt]===current_choice){
              this.state.choices.splice(jdx, 1);
            }
            jdx+=1;
          }
          this.setState( () =>{ 
            return {
              multiValue,
              dataSetsToRender: this.state.dataSetsToRender,
              choices: this.state.choices
            };
          });
        }
        idx+=1;
      }
      
    }


    /* MT THAT MANAGE THE BUTTON THAT COMPUTES SELECTED GENES MEDIAN FREQUENCY
      _______________________________________________________________________
      Result: state
    */
    updateButtonState(){
      if(this.state.stateButtonCp1==false){
        this.setState(()=>{
          return {
            stateButtonCp1: true
          };
        });
      }
      else{
        this.setState(()=>{
          return {
            stateButtonCp1: false
          };
        });
      }
    }

    displayMutationMatrix(){
      if(this.state.stateButtonCp2==false){
        let dict = this.getListOfFreqByMutForAllSamples(this.props.mergedMutations);
        this.handleShow();
        MutationMatrix(dict);
        this.setState(()=>{
          return { 
            stateButtonCp2: true
          };
        });
      }
      else{
        this.setState(()=>{
          return {
            stateButtonCp2: false
          };
        });
      }
    }

    enableFiltering(){
      if(this.state.stateButtonCp3==false){
        this.updateFilterOptions();
        this.setState(()=>{
          return {
            stateButtonCp3: true
          };
        });
      }
      else{
        this.setState(()=>{
          return {
            stateButtonCp3: false
          };
        });
      }
    }

    enableDisplayOfFragmentLength(){
      if(this.state.stateButtonCp4==false){
        this.setState(()=>{
          return {
            stateButtonCp4: true
          };
        });
      }
      else{
        this.setState(()=>{
          return {
            stateButtonCp4: false
          };
        });
      }
    }

    disableLineRepDisplay(){
      if(this.state.displayLineRep==false){
        this.showLineRep();
      }
      else{
        this.hideLineRep();
      }
    }


    updateDataSets(){
      let current_datasetToRender = this.state.dataSetsToRender;
      let current_dataset = this.state.dataSets;
      for(let dataset in current_datasetToRender){
        if(current_dataset.includes(current_datasetToRender[dataset])==false){
          current_dataset.push(current_datasetToRender[dataset]);
        }
      }
      this.setState({dataSets: current_dataset})
    }

    updateFilterOptions(){
      let updated_list = this.state.filterOptions;
      let idx = 0;
      let list_idx = [];
     
      for(let elt in this.state.filterOptions){
        let list_of_tp = this.getListOfFBySampleForOneGene(this.state.filterOptions[elt].value, this.props.mergedMutations);
        let length = 0
        for(let val in list_of_tp){
          length+=1;
        }
        if(length<=1){
          list_idx.push(idx);
          this.state.filterOptions.splice(idx, 1);
        }
        idx+=1;
      }
      let j = 0;
      for(let i in this.state.filterOptions){
        j+=1;
      }
      this.setState( () =>{ 
        return {
          filterOptions: this.state.filterOptions
        };
      });      
    }


    updateInfoToDisplay(list:any){
      this.setState(() => {
        return{
          infoToDisplay: list
        };
      });
    }


    handleChange(color:any, event:any){
      this.setState( () =>{ 
        return{
          color: color.hex
        };
      });
    }

    displayListOfCorrelatedMutations(){
      if(this.state.stateButtonCp5==false){
        let dict = this.getListOfFreqByMutForAllSamples(this.props.mergedMutations);
        let list = getCorrelatedMutations(dict);
        let dataToDisplay: any = [];

        let mutA, mutB, corrValue, listA, listB, idA, idB, posA, posB, chA, chB;
        
        let i = 0;
        for(let elt in list){
          mutA = list[elt][0];
          listA = mutA.split(":");
          idA = listA[0];
          posA = listA[1];
          chA = listA[2];
          mutB = list[elt][1];
          listB = mutB.split(":");
          idB = listB[0];
          posB = listB[1];
          chB = listB[2];
          corrValue = list[elt][2];
          dataToDisplay.push({nb:i, gA:idA, PosA:posA, chA: chA, gB:idB, PosB:posB, chB:chB, corrVal:corrValue});
          i+=1;
        }
        this.setState(()=>{
          return {
            showCMData: dataToDisplay,
            stateButtonCp5: true
          };
        });
      }
      else{
        this.setState(()=>{
          return {
            stateButtonCp5: false
          };
        });
      }
    }

    displayLineRepForOneMut(inputdict:any, color:any){
      let dataToDisplay: any = [];
      let formattedData:any = [];
      for(let key in inputdict){
        formattedData.push({a: Number(key), b:inputdict[key]});
      }
      dataToDisplay.push(
        <VictoryGroup data={formattedData} color={color} x="a" y="b">
          <VictoryLine style={{data:{strokeWidth:1}}}/>
        </VictoryGroup>);
      this.setState(()=>{
        return {
          showMutLine: dataToDisplay
        };
      });
    }

    deleteLineRep(){
      this.setState(()=>{
        return {
          showMutLine: null
        };
      });
    }

    /*
      GETTER
    */


    /* MT TO GET THE LIST OF ALL GENES (AND IGNORES DUPLICATE)
      ________________________________________________________
      Return: []
    */
    private getListOfGenesFilteredVersion(mergedMutations: Mutation[][]){
      let geneList = [];
      let geneList_cp = [];
      let gene, mut, key;

      for(const mutations of mergedMutations){
        for(const mutation of mutations){
          gene = mutation.gene;
          mut = mutation.proteinChange;
          key = gene.hugoGeneSymbol+":"+mut; 
          if(this.checkListContent(geneList_cp, key)===false){
            geneList.push({value: key, label: key});
            geneList_cp.push(key);
          }
        }
      }
      geneList = geneList.sort();
      return geneList;
    }


    /* MT TO GET THE LIST OF F BY SAMPLES AND FOR EACH GENE
      _____________________________________________________
      Return: [CHOICE,{S_ID:FREQ}, COLOR, [T_ALT_CT], [T_REF_CT]]
    */
    private getListOfFBySampleForOneGeneMutWithRef(choice:string, mergedMutations: Mutation[][]){
      let array = this.getSortedGeneFrequencyBySampleArray(mergedMutations);
      let arrayOfFreq = this.getListOfFreqByGeneBySample(mergedMutations);
      let output_dict:{[key:string]:string} = {};
      let output_list:any = [];
      let color = this.state.color;

      let output_l: any = [];
      let output_d: any = [];

      let listOfFreq: any = [];

      let geneID = choice.split(":")[0]
      let protChange = choice.split(":")[1]

      for(let elt in array){
        let current_element = array[elt];
        if((current_element['GENE_ID'].localeCompare(geneID))===0&&(current_element['PROT_CHANGE'].localeCompare(protChange))===0){
          console.log("PASSED");
          output_dict[current_element['SAMPLE_ID']]=current_element['FREQ'];
          //listOfFreq = this.getListOfFreqForOneGeneAllSamples(arrayOfFreq, current_element['GENE_ID']);
          output_l.push(current_element['TALTCT']);
          output_d.push(current_element['TREFCT']);
        }
      }
      /*
      for(let elt in array){
        let current_element = array[elt];
        if((current_element['GENE_ID'].localeCompare(choice))===0){
          output_dict[current_element['SAMPLE_ID']]=current_element['FREQ'];
          listOfFreq = this.getListOfFreqForOneGeneAllSamples(arrayOfFreq, current_element['GENE_ID']);
          output_l.push(current_element['TALTCT']);
          output_d.push(current_element['TREFCT']);
        }
      }
      */

      output_list.push(choice);
      output_list.push(output_dict);
      output_list.push(color);
      output_list.push(output_l);
      output_list.push(output_d);
      

      //output_list.push(listOfFreq);
      return output_list;
    }


    /* MT TO GET THE LIST OF F BY SAMPLE FOR ONE GENE
      ________________________________________________
      return: []
    */
    private getListOfFBySampleForOneGene(choice:string, mergedMutations: Mutation[][]){
      let list_input = this.getListOfFBySampleForOneGeneMutWithRef(choice, mergedMutations);
      return list_input[1];
    }

    
    /* MT THAT COMPUTE FOR EACH GENES THE FREQ BASED ON T_ALT ET T_REF AND SORTS THEM BY SAMPLES
      __________________________________________________________________________________________
      Return: [{GENE_ID: IDH1, S_ID: SAMPLE1, FREQ: 0.5, DATE: NB, TALTCT: NB, TREFCT: NB}]
    */
    private getSortedGeneFrequencyBySampleArray(mergedMutations: Mutation[][]){
      let geneFrequencyBySampleID = [];

      let key;
      let sampleID;
      let gene, geneID;
      let frequency;
      let protChange;

      let listOfDates=this.getListOfDates(this.props.mergedMutations);

      let listOfGenes:any = [];
      let dictGenesWithFreq:any = {};

      let i = 0;
      for (const mutations of mergedMutations) {
        for (const mutation of mutations) {
            if (mutation.tumorAltCount >= 0 && mutation.tumorRefCount >= 0) {
                let dict : any = {};
                sampleID = mutation.sampleId;
                gene = mutation.gene;
                geneID = gene.hugoGeneSymbol;
                frequency = mutation.tumorAltCount / (mutation.tumorRefCount + mutation.tumorAltCount);
                protChange = mutation.proteinChange;
                
                key = geneID+":"+protChange;

                if(listOfGenes.includes(key)===false){
                  listOfGenes.push(key);
                }

                let keys = Object.keys(dictGenesWithFreq);

                if(keys.includes(key)===false){
                  let freqList = []
                  freqList.push(frequency);
                  dictGenesWithFreq[key]=freqList;
                }

                else{
                  dictGenesWithFreq[key].push(frequency)
                }

                /*
                if(listOfGenes.includes(gene.hugoGeneSymbol)===false){
                  listOfGenes.push(gene.hugoGeneSymbol);
                }

                let keys = Object.keys(dictGenesWithFreq);

                if(keys.includes(gene.hugoGeneSymbol)===false){
                  let freqList = []
                  freqList.push(frequency);
                  dictGenesWithFreq[gene.hugoGeneSymbol]=freqList;
                }

                else{
                  dictGenesWithFreq[gene.hugoGeneSymbol].push(frequency)
                }
                */
                dict['GENE_ID']=geneID;
                dict['PROT_CHANGE']=protChange;
                dict['SAMPLE_ID']=sampleID;
                dict['FREQ']=frequency;
                dict['MUT_FREQ_LIST']=[];
                dict['DATE']=listOfDates[i];
                dict['TALTCT']=mutation.tumorAltCount;
                dict['TREFCT']=mutation.tumorRefCount + mutation.tumorAltCount;

                geneFrequencyBySampleID.push(dict);
                i+= 1;            
            }
        }
      }

      for(let elt in geneFrequencyBySampleID){
        for(let subElt in dictGenesWithFreq){
          if(geneFrequencyBySampleID[elt]['GENE_ID']===subElt){
            geneFrequencyBySampleID[elt]['MUT_FREQ_LIST'].push(dictGenesWithFreq[subElt]);
          }
        }
      }

      return geneFrequencyBySampleID;
    }


    /* MT TO GET ALL FREQ FOR ALL GENES IN ALL SAMPLES
      ________________________________________________
      Return: {{SID_GID:[FREQ]}}
    */
    private getListOfFreqByGeneBySample(mergedMutations: Mutation[][]){
      let frequency, geneID, sampleID; 
      let dict:any={};
      let listOfKeys:any=[];

      for (const mutations of mergedMutations) {
        for (const mutation of mutations) {
          if (mutation.tumorAltCount >= 0 && mutation.tumorRefCount >= 0) {
            let subList:any=[];
            geneID = mutation.gene.hugoGeneSymbol;
            sampleID = mutation.sampleId;
            let key = sampleID+":"+geneID;

            frequency = mutation.tumorAltCount / (mutation.tumorRefCount + mutation.tumorAltCount);
            listOfKeys=Object.keys(dict);
                
            if( listOfKeys.length === 0){
              let listOfF = [];
              listOfF.push(frequency);
              dict[key]=listOfF;
            }               
              
            if(listOfKeys.includes(key)===true){
              dict[key].push(frequency)
            }
                
            if(listOfKeys.includes(key)===false){
              let listOfF = [];
              listOfF.push(frequency);
              dict[key]=listOfF;
            }
          }
        }
      }
      return dict;
    }


    /* MT TO GET THE LIST OF FREQ FOR BY MUT FOR ALL SAMPLES/TPS
      ______________________________________________________
      Return: {GENEID_POS_CH:[VAF1, VAF2, VAF3]}
    */
    private getListOfFreqByMutForAllSamples(mergedMutations: Mutation[][]){
      let id, gene, chrom, pos, frequency;
      let listOfVAF;
      let dict:any = {}, listOfKeys;

      for(const mutations of mergedMutations){
        for(const mutation of mutations){
          gene = mutation.gene.hugoGeneSymbol;
          chrom = mutation.gene.chromosome;
          pos = mutation.startPosition;
          frequency = mutation.tumorAltCount / (mutation.tumorRefCount + mutation.tumorAltCount);
          id = gene+":"+pos+"_ch"+chrom;
          listOfKeys=Object.keys(dict);

          if(listOfKeys.includes(id)===false){
            let listOfVAF = [];
            listOfVAF.push(frequency);
            dict[id]=listOfVAF;
          }
          if(listOfKeys.includes(id)===true){
            dict[id].push(frequency);
          }    
        }
      }
      return dict;
    }


    /* MT TO GET THE LIST OF FREQ FOR ONE GENE AND ALL SAMPLES
      _________________________________________________________
      Return: {SID:{GID:[FREQ]}}
    */
    private getListOfFreqForOneGeneAllSamples(dict:any, geneID: any){
      let listKey:any=[];
      let sIDKey, gIDKey, nSample;
      let output_dict:any={};

      for(let key in dict){
        let listOfMatch = key.match(/-H[0-9]/);
        if(listOfMatch!==null || listOfMatch!==undefined){
          listKey=key.split(":");
          
          nSample=listKey[3];
          gIDKey=listKey[4];
          sIDKey=listKey[0]+":"+listKey[1]; 
          if(nSample=="PR2"){
            let list = listKey[1].split("",6);
            let nb = ""+(+list[3]+1);
            let newDate =listKey[1].substr(0,3)+nb+listKey[1].substr(4,6);
            sIDKey = listKey[0]+":"+newDate;
          }
          if(geneID===gIDKey){
            output_dict[sIDKey]=dict[key]
          }
        }
        if(listOfMatch===null){
          listKey=key.split(":");
          sIDKey=listKey[0]+":"+listKey[1];
          gIDKey=listKey[2];
          if(geneID===gIDKey){
            output_dict[sIDKey]=dict[key]
          }         
        }
      }
      return output_dict;
    }       



    /* MT TO GET ALL MF FOR ONE GENE
      ____________
      Return: [Choice, {SID:FREQ}, COLOR, [TALTCT], [TREFCT]]
    */
    private getAllFreqByGenes(choice: string, mergedMutations: Mutation[][]){
      let array = this.getSortedGeneFrequencyBySampleArray(mergedMutations);
      let output_dict:{[key:string]:string} = {};
      let output_list:any = [];
      let color = this.state.color;

      let output_l: any = [];
      let output_d: any = [];

      for(let elt in array){
        let current_element = array[elt];
        if((current_element['GENE_ID'].localeCompare(choice))===0){
          output_dict[current_element['SAMPLE_ID']]=current_element['FREQ'];
          output_l.push(current_element['TALTCT']);
          output_d.push(current_element['TREFCT']);
        }
      }
      output_list.push(choice);
      output_list.push(output_dict);
      output_list.push(color);
      output_list.push(output_l);
      output_list.push(output_d);
      return output_list;
    }


    /* MT TO STORE ALL MUTATIONS INFO (TO RENDER THEM LATER IN A PANEL)
      _________________________________________________________________
      
      Return: [[GENE1,{SAMPLE1:[INFO1,INFO2,...,INFO(N+1)], SAMPLE2:[INFO1,INFO2,...,INFO(N+1)]}], [GENE2, ,{SAMPLE1:[INFO1,INFO2,...,INFO(N+1)], SAMPLE2:[INFO1,INFO2,...,INFO(N+1)]}]]
    */
    private getAllMutationsInfo(mergedMutations: Mutation[][]){
      let output_list:any = [];
      let sampleID, gene, startDate; 
      
      for (const mutations of mergedMutations) {
        for (const mutation of mutations) {
            if (mutation.tumorAltCount >= 0 && mutation.tumorRefCount >= 0) {
                let list : any = [];
                let dict : any = {};
                let listOfInfo : any = [];
                
                sampleID = mutation.sampleId;
                gene = mutation.gene;
                startDate = this.compareIDToDate(this.state.listOfDates, sampleID);
                let frequency = mutation.tumorAltCount / (mutation.tumorRefCount + mutation.tumorAltCount);

                listOfInfo.push(mutation.tumorAltCount, mutation.tumorRefCount + mutation.tumorAltCount, mutation.fisValue, mutation.functionalImpactScore);
                listOfInfo.push(mutation.mutationType, mutation.proteinChange, mutation.startPosition, mutation.endPosition, gene.hugoGeneSymbol, frequency);

                list.push(gene.hugoGeneSymbol, frequency);
                dict[startDate]=listOfInfo;
                list.push(dict);
                
                output_list.push(list);
            }
        }
      }
      return output_list;
    }


    /* MT TO EXTRACT MUTATION BASED ON GENE AND SAMPLE ID
      ___________________________________________________
      Return: []
    */
    private getInfoWithGeneAndSampleIDAndFreq(geneID:any, sampleID:any, freq:any){
      let output_list:any = [];
      let dictInfo = this.state.listOfInfo;

      for(let elt in dictInfo){
        if(dictInfo[elt][0]==geneID){
          let dict = dictInfo[elt][2];
          let key = Object.keys(dict)[0];
          if(dictInfo[elt][1]==freq){
            dict[key].push(key);
            return dict[key];
          }
        }
      }
    }

    /* MT TO GET ALL TP INFOS FOR ONE SPECIFIC MUTATION
      _________________________________________________
      Return: {START_DATE:FREQ}
    */
    private getAllPointsForOneMutationOfOneGene(geneID: any, mut: any, sPos: any){
      let output_dict:any={};
      let dictInfo = this.state.listOfInfo;
      for(let elt in dictInfo){
        if(dictInfo[elt][0]==geneID){
          let dict = dictInfo[elt][2];
          let key = Object.keys(dict)[0];
          if(dict[key][4]===mut && dict[key][6]===sPos){
            output_dict[key]=dictInfo[elt][1];
          }
        }
      }
      return output_dict;
    }

    /* MT TO GET ALL TP INFOS FOR ONE SPECIFIC MUTATION USING POS
      ___________________________________________________________
      Return: {START_DATE:FREQ}
    */
   private getAllPointsForOneMutationOfOneGeneByPos(geneID: any, sPos: any){
    let output_dict:any={};
    let dictInfo = this.state.listOfInfo;
    for(let elt in dictInfo){
      if(dictInfo[elt][0]==geneID){
        let dict = dictInfo[elt][2];
        let key = Object.keys(dict)[0];
        let nbPos =+ sPos;
        if(dict[key][6]===nbPos){
          output_dict[key]=dictInfo[elt][1];
        }
      }
    }
    return output_dict;
  }


    /*
      UTILITIES METHODS
    */

    public checkDatasetToRenderContent(value:any, datasetToCheck:any){
      for(let index in datasetToCheck){
        if(datasetToCheck[index].value === value){
          return true;
        }
      }
      return false;
    }

    /*
        DATE / TIMELINE MANAGEMENT
    */


    /* MT TO GET THE LIST OF ALL DATES FOR SAMPLES OF A GIVEN PATIENT 
      _______________________________________________________________
      Return: listOfDates [] (list of START_DATE)
    */
    private getListOfDates(mergedMutations: Mutation[][]){
      let listOfDates:any=[];

      let timelineData = this.props.store.clinicalEvents.result.map((eventData:ClinicalEvent) => {
        listOfDates.push(eventData.startNumberOfDaysSinceDiagnosis);
      });

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

    
    /* MT TO FILL STATE DATE DICT
      ___________________________
      Return: {}
    */
    private getListOfDates_bis(mergedMutations: Mutation[][]){
      let dictOfDates:any={};
      let listOfDates:any=[];
      let listOfSID:any=[];

      let list_date_toConvert:any = [];
      for (const mutations of mergedMutations) {
        for (const mutation of mutations) {
          let date = this.getDateFromSampleID(mutation.sampleId);
          if(listOfSID.includes(mutation.sampleId)===false){
            listOfSID.push(mutation.sampleId);
          }
          if(list_date_toConvert.includes(date)==false){
            list_date_toConvert.push(date);
          }
        }
      }
      
      listOfDates = list_date_toConvert;
      dictOfDates = this.computeStartDateOfEachSamples_bis(list_date_toConvert);

      let listOfMatch = listOfSID[0].match(/-H[0-9]/);
      if(listOfMatch!=null){
        let keys = Object.keys(dictOfDates);
        let newDate = new Date();
        let date = new Date(keys[0]);
        newDate.setTime(date.getTime()+24*15*3600*1000)
      }

      return dictOfDates;
    }
    
    
    /* MT (DUPLICATED) TO COMPUTE THE START_DATE OF EACH DATES OF A LIST
      __________________________________________________________________
      Return: {}
    */
    private computeStartDateOfEachSamples_bis(listOfDates: any){
      let arrayOfDate: any = [];
      let dictOfDates:any = {};

      for(let date of listOfDates){
        arrayOfDate.push(this.convertToDateFormat(date));
      }

      let i = 0;
      let sortedDateArray = arrayOfDate.sort((a:any,b:any)=>a-b);
      let firstDate = sortedDateArray[0];
      
      for(let el in arrayOfDate){
        if(i==0){
          dictOfDates[arrayOfDate[el]]=0;
          i+=1
        }
        else{
          dictOfDates[arrayOfDate[el]]=this.dateDifference(firstDate, arrayOfDate[el]);
        }
      }
      return dictOfDates;
    }

  
    /* MT TO GENERATE LIST OF START_DATE BY SAMPLES
      _____________________________________________
      Return: []
    */
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


    /* MT TO GET BASED ON A SAMPLE_ID (USED IN LB DATA) THE CORRESPONDING DATE
      ________________________________________________________________________
      Return: Date (NB: START_DATE)
    */
    private compareIDToDate(listOfDates:any, sampleID:any){
      let dateV1 = this.getDateFromSampleID(sampleID);
      let dateV2 = this.convertToDateFormat(dateV1);
      for(let date in listOfDates){
        if(date===dateV2.toString()){
          return listOfDates[date];
        }
      }
    }

    /* MT TO EXTRACT FROM LB SAMPLEID A RAW DATE FORMAT
      ________________________________________________
      Return: DDMMYY
    */
    private getDateFromSampleID(sampleID: any){
      let listOfMatch = sampleID.match(/_[0-9]*/);
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

    
    
    /*
        COMPUTATIONAL METHODS
    */

    /* MT TO COMPUTE THE VAF BY SAMPLE
      ________________________________
      Return: {}
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
      for(const key of Object.keys(ret)){
          let sum = 0;
          for(const value of ret[key]){
              sum += value
          }
      }
      return ret;
    }
    

  
    /* MT TO COMPUTE GLOBAL MEDIAN FREQUENCIES OF ALL SAMPLES FOR A GIVEN PATIENTS
      ________________________________
      Return: {}
    */
    private computeMedianOfMutationFrequencies(){
      const inputData = this.computeMutationFrequencyBySample(this.props.mergedMutations);
      const outputData:any = {};
      for(const key of Object.keys(inputData)){
        let median=0;
        inputData[key] = inputData[key].filter(value => !Number.isNaN(value)) ;
        let SortedList = inputData[key].sort((n1,n2)=>n1-n2);
        let ListLength = SortedList.length;
        if(ListLength%2==0){
          median = ((SortedList[Math.round((ListLength-1)/2)]+SortedList[Math.round((ListLength/2))])/2)
        }
        else{
          median = SortedList[Math.round(ListLength/2)];
        }
        outputData[key]=median;
      }
      return outputData;
    }


    /* MT TO COMPUTE GLOBAL MEDIAN FREQUENCIES OF ALL SAMPLES FOR A GIVEN PATIENTS
      ________________________________
      Return: {}
    */
    private computeMedianOfMutationFrequenciesOfOneGene(){
      const inputData = this.computeMutationFrequencyBySample(this.props.mergedMutations);
      const outputData:any = {};
      for(const key of Object.keys(inputData)){
        let median=0;
        inputData[key] = inputData[key].filter(value => !Number.isNaN(value)) ;
        let SortedList = inputData[key].sort((n1,n2)=>n1-n2);
        let ListLength = SortedList.length;
        if(ListLength%2==0){
          median = ((SortedList[Math.round((ListLength-1)/2)]+SortedList[Math.round((ListLength/2))])/2)
        }
        else{
          median = SortedList[Math.round(ListLength/2)];
        }
        outputData[key]=median;
      }
      return outputData;
    }

    
    /* MT TO COMPUTE MEDIAN FREQUENCIES OF SELECTED GENES FOR A GIVEN PATIENTS
      ________________________________
      Return: {}
    */
    private computeSelectedGenesMedianFrequencies(datasetSelected:any){
      let listOfF = [];
      let listOfSampleID:any = [];
      let output_dict:any = {}

      for(let val in datasetSelected){
        let current_val = datasetSelected[val];
        let list = []
        for(let elt in current_val[1]){
          list.push(current_val[1][elt]);
          if(listOfSampleID.includes(elt)===false){
            listOfSampleID.push(elt);
          }
        }
        listOfF.push(list);
      }
      let n = this.getLengthOfLongestList(listOfF);
      let listOfResults:any = Array.from(new Array(n), (value, index)=>0);

      for(let list in listOfF){
        for(let idx in listOfF[list]){
          listOfResults[idx] += listOfF[list][idx];
          idx += 1;
        }
      }

      let i = 0;
      for(let elt in listOfResults){
        let mean = listOfResults[elt]/listOfF.length
        output_dict[listOfSampleID[i]]=mean;
        i+=1;
      }
      return output_dict;
    }


      
    /*
      Utility Methods
    */
  

    /* MT TO CHECK IF AN ELT IS PRESENT IN A LIST OR NOT
      __________________________________________________
      Return: Boolean (True/False)
    */
    private checkListContent(list:string[], element:string){
      let elt:string;
      for(elt in list){
        if((list[elt].localeCompare(element))===0){
          return true;
        } 
      }
      return false;
    }

  
    /* MT TO CONVERT/PREPARE DATA FROM A LIST TO VICTORY FORMAT
       ________________________________________________________
       Return: [{a: START_DATE (NB), B: FREQ (NB)}]
    */
    public formatDataForVictoryChart(inputlist:any){
      let outputlist:any=[];
      let listOfDates = this.getListOfDates(this.props.mergedMutations);
      let listMutDates:any=[];
      let cpt=0;
      for(let value in inputlist){
        let dateInt = this.compareIDToDate(this.state.listOfDates, value);
        if(listMutDates.includes(dateInt)==false){listMutDates.push(dateInt);}    
        outputlist.push({a: dateInt, b:inputlist[value], c:"T"});
        cpt+=1;
      }
      let listDates = Object.keys(this.state.listOfDates);
      let listStartDate = [];
      for(let date in listDates){
        listStartDate.push(this.state.listOfDates[listDates[date]]);
      }
      if(listDates.length!=listMutDates.length){
        for(let date in listStartDate){
          if(listMutDates.includes(listStartDate[date])==false){
            outputlist.push({a:listStartDate[date], b:0, c:"F"})
          }
        }
      }
      return outputlist;
    }

    /* MT TO CONVERT/PREPARE MUTATION DATA FROM A LIST TO VICTORY FORMAT
       ________________________________________________________
       Return: [{a: START_DATE (NB), B: FREQ (NB)}]
    */
    public formatMutationDataForVictoryChart(inputdict:any){
      let outputlist:any=[];
      let listMutDates:any=[];
      for(let key in inputdict){
        let dateInt = this.compareIDToDate(this.state.listOfDates, key);
        if(listMutDates.includes(dateInt)==false){listMutDates.push(dateInt);}        
        if(inputdict[key].length===1 && inputdict[key]<0.5){
          console.log("FX FMDFVC DATE = "+dateInt+"_FQ = "+inputdict[key]);
          outputlist.push({a: dateInt, b:inputdict[key]});
        }
        else{
          for(let elt in inputdict[key]){
              outputlist.push({a: dateInt, b:inputdict[key][elt]});
          }
        }
      }
      let listDates = Object.keys(this.state.listOfDates);
      let listStartDate = [];
      for(let date in listDates){
        listStartDate.push(this.state.listOfDates[listDates[date]]);
      }
      /*
      console.log(this.state.listOfDates[listDates[1]]);
      console.log("TOT DATES LENGTH = "+listDates.length)
      console.log("CUR DATES LENGTH = "+listMutDates.length)
      if(listDates.length!=listMutDates.length){
        for(let date in listStartDate){
          if(listMutDates.includes(listStartDate[date])==false){
            outputlist.push({a:listStartDate[date], b:0, color:"white"})
          }
        }
      }
      */
      return outputlist;
    }

    /* MT TO CONVERT/PREPARE SOMATIC MUT DATA FROM A LIST TO VICTORY FORMAT
       ________________________________________________________
       Return: [{a: START_DATE (NB), B: FREQ (NB)}]
    */
    public formatSomaticDataForVictoryChart(inputdict:any){
      let outputlist:any=[];
      for(let key in inputdict){
        let dateInt = this.compareIDToDate(this.state.listOfDates, key);
          outputlist.push({a: dateInt, b:inputdict[key]});
          console.log("FX FSDFVC DATE = "+dateInt+"_FQ = "+inputdict[key]);
          for(let elt in inputdict[key]){
            if(inputdict[key][elt]>0.5){
              outputlist.push({a: dateInt, b:inputdict[key][elt]});
            }
          }
      }
      return outputlist;
    }


    /* MT TO FORMAT DATA FOR VICTORY LEGEND DISPLAY
      _____________________________________________
      Return: []
    */
    private getDataForLegendDisplay(datasets:any){
      let data_list: any = [];
      let i = 0;
      for(let datas in datasets){
        let dict: any = {};
        dict['label']=datasets[datas][0];
        let dictOfdict:any = dict['symbol']={};
        dictOfdict['fill']=datasets[datas][2];
        dict['name']=datasets[datas][0];
        data_list.push(dict);
        i+=1;
      }
      data_list.push({name:"Missing Data", symbol:{fill:"white", stroke:"grey", strokeWidth:0.4}});
      return data_list;
    }


    /* MT TO GET THE LENGTH OF THE LONGEST LIST IN A DOUBLE ARRAY
      ___________________________________________________________
      Return: maxLength (NB)
    */
    private getLengthOfLongestList(listOfList:any){
      let maxLength = 0;
      let lengthOfList: number;

      for(let list in listOfList){
        lengthOfList = listOfList[list].length;
        if(lengthOfList>maxLength){
          maxLength = lengthOfList;
        }
      }
      return maxLength;
    }


    /* MT TO EXTRACT T_ALT AND T_REF FROM A LIST OF DICT
      __________________________________________
      Return: [T_ALT, T_REF]
    */
    private getTAlt(geneID: string, startDate: any, freq: any, list: any){
      for(let elt in list){
        let sublist = list[elt];

        if(sublist[0]===geneID){
          if(sublist[1]===freq){
            let dict = sublist[2];
            if((dict!==undefined || dict!==null)&&dict[startDate]!==undefined){
              return dict[startDate][0];
            }
            else{
              return 0;
            }
          }
        }
      }
    }

    private getTRef(geneID: string, startDate: any, freq: any, list: any){
      for(let elt in list){
        let sublist = list[elt];
        
        if(sublist[0]===geneID){
          if(sublist[1]===freq){
            let dict = sublist[2];
            if((dict!==undefined || dict!==null)&&dict[startDate]!==undefined){
              return dict[startDate][1];
            }
            else{
              return 0;
            }
          }
        }
      }
    }

    /*
      PROJECT PART II
    */


    /* MT TO FILTER THE MUTATIONS/GENES TO DISPLAY (ONLY DISPLAY THOSE WHO HAVE MORE THAN 1 TP)
      _________________________________________________________________________________________    
      Return: [] (List of indexes)
    */
    public hideGenesWithOneTP(){
      let availableOptions = this.state.filterOptions;
      let idx = 0;
      let list_idx = [];
      for(let elt in availableOptions){
        let list_of_tp = this.getListOfFBySampleForOneGene(availableOptions[elt].value, this.props.mergedMutations);
        let length = 0;
        for(let val in list_of_tp){
          length+=1;
        }
        if(length<=1){
          list_idx.push(idx);
          idx+=1;
        }
        idx+=1;
      }
      return list_idx;
    }


    /* MT TO GET MAX VALUE OF A LIST
      ______________________________
      Return: INT
    */
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
      PART RELATED TO GRAPH EXPORT
    */
    private svgContainer: HTMLDivElement;
    

    /* MT TO GET/EXPORT A DOM ELT INTO AN SVG ELT
      ___________________________________________
      Return: SVG ELT
    */
    @autobind
    private getSvg() {
      return this.containerRef.firstElementChild as SVGElement;
    }

    /*

    */
    private checkDivChildComponents(divId:any){
      var element = document.getElementById(divId);
      if(element!== null){
        var count = element.childElementCount;
        if(count===1){
          return false;
        }
        if(count>1){
          return true;
        }
      }
      return false;
    } 


    private displaySelectedInfos(){

    }

    render() {
    
      let maxValue = this.getMaxValue(this.getListOfDates_bis(this.props.mergedMutations));

      const VictoryZoomVoronoiRefContainer = createContainer("zoom", "voronoi", "ref");

      let listTickValues = Array.from(new Array(Math.round(maxValue/365)), (value, index)=>index+1);
      for(let i in listTickValues){
        listTickValues[i]= listTickValues[i]*365;
      }
      
      let cdata = this.props.cosmicData;

      console.log('DT to render = '+this.state.dataSetsToRender);

      console.log('DT to render length = '+this.state.dataSetsToRender.length);
      

      return (
      <div>
      <Grid>
        <Col>

        {/*_FGMT Length Display_*/}

        { this.state.stateButtonCp4===true && (
        <div title = "Fragment Length display">
          {/* Fragment Length graph */}
          <VictoryChart
            name="FragmentLengthChart"
            padding={{ top: 15, left: 40, right: 60, bottom: 10 }}
            theme={VictoryTheme.material}
            width={400}
            height={200}
            scale={{x:"time", y:"frequency"}}
            maxDomain={{x:maxValue+1,y:1}}
            minDomain={{x:0,y:0}}
            style={{
              parent:{
                fontSize: 6.5, style: "italic"
              }
            }}
            containerComponent={
              <VictoryZoomVoronoiRefContainer
                allowZoom={false}
                allowSpan={false}
                zoomDomain={this.state.zoomDomain}
                onZoomDomaininChange={this.handleZoom.bind(this)}
                containerRef={(ref: any) => { this.containerRef = ref; }}
              />
            }
          >

          {/* Y AXIS */}
          <VictoryAxis
            dependentAxis 
            orientation="left"
            theme={VictoryTheme.material}
            domain={[0.5, 1]}
            style={{
              grid:{stroke: "grey"},
              axis: {stroke: "#595959"},
              axisLabel:{fontSize: 8, style: "italic"},
              ticks: {stroke:"grey", size:3},
              tickLabels:{fontSize:6, padding:5}
            }}
            standalone={false}
          />

          {/* X AXIS */}
          <VictoryAxis
            standalone={false}
            orientation="bottom"
            theme={VictoryTheme.material}
            domain={[0, maxValue+1]}
            tickValues={[this.state.listOfStartDate]}
            tickFormat={(t:any)=>`${Math.round(t/30*100)/100}m`}
            style={{
              grid:{stroke: "grey"},
              axis: {stroke: "#595959"},
              axisLabel:{fontSize: 8, style: "italic"},
              ticks: {stroke:"grey", size:3},
              tickLabels:{fontSize:6, padding:5}
            }}
          />

           
         {/* GENE */} 
          
         {this.state.dataSetsToRender.length>0 && this.state.dataSetsToRender.map((dataSet: any,i: any)=>(
            this.state.dataSets.includes(dataSet)==false?(
            <VictoryGroup 
              key={dataSet[0]}
              data={this.formatSomaticDataForVictoryChart(dataSet[1])} 
              color={dataSet[2]}
              x="a"
              y="b"
              labels={(d: { b: any; a: any; })=>[`START_DATE: ${d.a}`,`Gene: ${dataSet[0]}`,`freq: ${String(Math.round(d.b*100)/100)}`, `${this.getTAlt(dataSet[0], d.a, d.b,this.state.listOfInfo)} variant reads out of ${this.getTRef(dataSet[0], d.a, d.b,this.state.listOfInfo)}`]}
              labelComponent={
              <VictoryTooltip
                cornerRadius={0.2}
                pointerWidth={0.8}
                borderWidth={0.1}
                flyoutStyle={{
                  fill:"white",
                  border:{stroke:"#e6e6e6"},
                  width:0.1
                }}
                style={{
                  fontSize:4,
                  border:{stroke:"#e6e6e6"},
                  borderWidth:0.1 
                }}
              />
            }
            >
            <VictoryLine/>
            <VictoryScatter 
              data={this.formatDataForVictoryChart(dataSet[1])} 
              x="a"
              y="b"
              size={2}
              events = {[{
                target: "data",
                eventHandlers: {
                  onMouseOver: () => {
                  },

                  onMouseOut: () => {
                    return [{
                      target: "data",
                      mutation: () => {}
                    }]
                  },

                  onClick: () => {
                    return [{
                      target: "data",
                      mutation:(props:any)=>{
                        let data = props.data[0]
                        let list = props.data[props.index];
                        this.updateInfoToDisplay(this.getInfoWithGeneAndSampleIDAndFreq(dataSet[0], data['_x'], list['b']));
                      }
                    }];                   
                  }
                }
              }]}
              
            />
             
            <VictoryLegend 
              x={350} y={100}
              title="features"
              centerTitle
              orientation="vertical"
              style={{
               title: {fontSize: 5},
                labels: {fontSize:5}
              }}
              data = {[
               {label: dataSet[0], symbol: dataSet[2], name: dataSet[0]}
              ]}
            />
          </VictoryGroup>
          ):Next
          ))}

          {this.state.dataSetsToRender.length>0 ? (
          <VictoryLegend 
            x={350} y={75}
            centerTitle
            orientation="vertical"
            style={{
              border: {stroke:"grey"},
              title: {fontSize: 5},
              labels: {fontSize:5}
            }}
            data={this.getDataForLegendDisplay(this.state.dataSetsToRender)}
          />) : null
          } 
            </VictoryChart>
          </div>
        )}
          
        
        {/*_FGMT Length Display_END*/}


        <hr/>
        <div id="timeline" ref = {(container) => {this.svgContainer = container!}}>
          {/* MF OF SELECTED GENES */}
          <VictoryChart
            name="FragmentLengthChart"
            padding={{ top: 15, left: 40, right: 60, bottom: 25 }}
            theme={VictoryTheme.material}
            width={400}
            height={200}
            scale={{x:"time", y:"frequency"}}
            maxDomain={{x:maxValue+1,y:1}}
            minDomain={{x:0,y:0}}
            style={{
              parent:{
                fontSize: 6.5, style: "italic"
              }
            }}
            containerComponent={
              <VictoryZoomVoronoiRefContainer
                allowZoom={false}
                allowSpan={false}
                zoomDomain={this.state.zoomDomain}
                onZoomDomaininChange={this.handleZoom.bind(this)}
                containerRef={(ref: any) => { this.containerRef = ref; }}
              />
            }
          >

          {/* Y AXIS */}
          <VictoryAxis
            dependentAxis 
            orientation="left"
            theme={VictoryTheme.material}
            label = "Frequency"
            axisLabelComponent={<VictoryLabel dy={-20}/>}
            domain={[-0.1, 1]}
            style={{
              grid:{stroke: "grey"},
              axis: {stroke: "#595959"},
              axisLabel:{fontSize: 8, style: "italic"},
              ticks: {stroke:"grey", size:3},
              tickLabels:{fontSize:6, padding:5}
            }}
            standalone={false}
          />

          {/* X AXIS */}
          <VictoryAxis
            standalone={false}
            orientation="bottom"
            theme={VictoryTheme.material}
            domain={[0, maxValue+1]}
            tickFormat = {(t:any)=>`${(t*100)/100}d`}
            style={{
              grid:{stroke: "grey"},
              axis: {stroke: "#595959"},
              axisLabel:{fontSize: 8, style: "italic"},
              ticks: {stroke:"grey", size:3},
              tickLabels:{fontSize:6, padding:5}
            }}
          />

           
         {/* GENE */} 

          {this.state.dataSetsToRender.length>0 ? this.state.dataSetsToRender.map((dataSet: any,i: any)=>(
            this.state.dataSets.includes(dataSet)==false?(
            <VictoryGroup 
              id="geneVisu"
              key={dataSet[0]}
              data={this.formatDataForVictoryChart(dataSet[1])}
              x="a"
              y="b"
              
              labelComponent={
              <VictoryTooltip
                cornerRadius={0.2}
                pointerWidth={0.8}
                borderWidth={0.1}
                flyoutStyle={{
                  fill:"white",
                  border:{stroke:"#e6e6e6"},
                  width:0.01
                }}
                style={{
                  fontSize:4,
                  border:{stroke:"#e6e6e6"},
                  borderWidth:0.01 
                }}
              />
            }
            >

            { this.state.displayLineRep===true ?
            (<VictoryLine color={dataSet[2]} style={{data:{strokeWidth:1}}}/>):null}

            <VictoryScatter 
              data={this.formatDataForVictoryChart(dataSet[1])} 
              
              x="a"
              y="b"
              size={3}
              style={{
                data:{
                  fill:(d:any)=>d.c==="F" ? "white" : dataSet[2],
                  fillOpacity:1,
                  stroke:dataSet[2],
                  strokeWidth:0.5,
                }             
              }}
              events = {[{
                target: "data",
                eventHandlers: {
                  onMouseOver: () => {
                    return [{
                      target: "data",
                      mutation: (props:any) => {
                        let data = props.data[0]
                        let list = props.data[props.index];
                        this.updateInfoToDisplay(this.getInfoWithGeneAndSampleIDAndFreq(dataSet[0].split(':')[0], data['_x'], list['b']));     
                       }
                  
                    }];
                  },
                  onMouseOut: () => {
                    return [{
                      target: "data",
                      mutation: () => {}
                    }]
                  },
                  onClick: () => {
                    if(this.state.displayLineRep==false){
                      return [{
                        target: "data",
                        mutation:()=>{
                          this.showLineRep();
                        }
                      }];
                    }
                    else{
                      this.hideLineRep();
                      return null;
                    }
                  }
                }
              }]}
              
            />
          </VictoryGroup>
          ):Next
          )):null}
          
            

          {/* GENE */}


          {/* MF OF SELECTED GENES */}

          {this.state.stateButtonCp1 == true ?
            (<VictoryGroup
              data={this.formatDataForVictoryChart(this.computeSelectedGenesMedianFrequencies(this.state.dataSetsToRender))}
              x="a"
              y="b"
              color="grey"
              style={{data:{strokeWidth:1, fillOpacity:0.5}}}
            >
            <VictoryLine/>
            <VictoryScatter
              size={2}
            />
            </VictoryGroup>): null
          }


        {(this.state.dataSetsToRender.length>0 && this.state.dataSetsToRender[0][0]!=[Object]) ? (
          <VictoryLegend 
            x={350} y={75}
            centerTitle
            orientation="vertical"
            style={{
              border: {stroke:"grey"},
              title: {fontSize: 5},
              labels: {fontSize:5}
            }}
            data={this.getDataForLegendDisplay(this.state.dataSetsToRender)}
          />)
          : null
          } 
      
          </VictoryChart> 

          <hr/>

          {/*
              SCROLLBAR GRAPH
          */}
          <VictoryChart
            padding={{ top: 0, left: 40, right: 60, bottom: 30 }}
            width={400} height={50} scale={{ x: "timepoints" }}
            maxDomain={{x:maxValue,y:1}}
            minDomain={{x:0,y:-0.05}}
            containerComponent={
              <VictoryBrushContainer
                brushDimension="x"
                brushDomain={this.state.zoomDomain}
                onBrushDomainChange={this.handleZoom.bind(this)}
              />
            }
          >
            <VictoryAxis
            label="Timeline"
            axisLabelComponent={<VictoryLabel className="labels" dy= {-5} />}
            tickValues = {listTickValues}
            tickFormat = {(t:any)=>`${Math.round((t/365)*100)/100}y`}
            style={{
              axis: {stroke: "grey"},
              grid:{stroke: "grey"},
              axisLabel:{
                fontSize: 8, 
                style: "italic"},
              ticks: {stroke:"grey", size:3},
              tickLabels:{fontSize:5, padding:5}
            }}
            />


            <VictoryAxis
              orientation="top"
              tickFormat = {()=>``}
              style={{
                axis: {stroke: "grey"}
              }}
            />

            <VictoryAxis
              orientation="left"
              tickFormat = {()=>``}
              style={{
                axis: {stroke: "grey"}
              }}
            />

            <VictoryAxis
              orientation="right"
              tickFormat = {()=>``}
              style={{
                axis: {stroke: "grey"}
              }}
            />


            {this.state.dataSetsToRender.length>0 ? this.state.dataSetsToRender.map((dataSet: any,i: any)=>(
            this.state.dataSets.includes(dataSet)==false?(
            <VictoryGroup 
              key={dataSet[0]}
              data={this.formatDataForVictoryChart(dataSet[1])} 
              color={dataSet[2]}
              x="a"
              y="b"
            >

            <VictoryScatter 
              data={this.formatDataForVictoryChart(dataSet[1])}
              size={1}
              style={{
                data:{
                  fill:(d:any)=>d.c==="F" ? "white" : dataSet[2],
                  fillOpacity:1,
                  stroke:dataSet[2],
                  strokeWidth:0.5,
                }             
              }}
              x="a"
              y="b"             
            />
          </VictoryGroup>
          ):Next
          )):null}

          </VictoryChart>


          </div>
          </Col>
          

          {/*Drop*/}    
          <hr/>

          <Row>
             {" "} 
            <Col xs={6} md={4} title="Color Selection">
              <SliderPicker
                color={this.state.color}
                onChange={this.handleChange.bind(this)}
              />
            </Col>
            

            <Col id="Gene-Container" xs={10} md={8} width={80}>
              <Select
                name="select"
                placeholder="Select Mutation(s) to display"
                value={this.state.multiValue}
                options={this.state.filterOptions}
                onChange={this.handleMultiChange}
                className="basic-multi-select"
                clearable={true}
                multi={true}
              />
            </Col>
          
          
          {" "}
          </Row>
          <hr/>

          <Row>
          <Col xs={6} md={4}>
          <Button
            id="Comp_bt1"
            onClick = {this.updateButtonState.bind(this)}>
            Median of Mutational Frequencies
          </Button>

          </Col>

          <Col xs={6} md={2} title="Click to filter the mutations that are present in only one timepoint">
          <Button
            id="Comp_bt3"
            onClick = {this.enableFiltering.bind(this)}
            >
            Filter Mutation
          </Button>
          </Col>

          <Col xs={6} md={2} title="Click to generate a correlation matrix">
            <Button
              id="Comp_bt2"
              onClick = {this.displayMutationMatrix.bind(this)}
            >
              Correlation Matrix
            </Button>
          </Col>

          <Col xs={6} md={2} title="Click to show somatic mutations">
            <Button
              id="Comp_bt4"
              //onClick = {this.enableLineRepDisplay.bind(this)}
              onClick = {this.disableLineRepDisplay.bind(this)}
              >
              Display Lines
            </Button>
          </Col>

          <Col xs={6} md={2}>
            <DownloadControls
              getSvg={this.getSvg}
              filename={"timepointGraph"}
              dontFade={true}
              collapse={true}
            />
          </Col>

          </Row>    

          

          <hr/>
          <Row>
              <Col xs={6} md={4}>
              <Panel>
                Mutation Information
                <hr/>
                {this.state.infoToDisplay!=null ?
                  <div>
                    <p> Start date : {this.state.infoToDisplay[10]} </p>
                    <p> Gene : {this.state.infoToDisplay[8]}</p>
                    <p> Mutation Type : {this.state.infoToDisplay[4]}</p>
                    <p> Mutation Frequency : {Math.round((this.state.infoToDisplay[0]/this.state.infoToDisplay[1])*100)/100}</p>
                    <p> Functional Impact Score (FIS) : {this.state.infoToDisplay[3]}</p> 
                    <p> Protein Change : {this.state.infoToDisplay[5]}</p>
                    <p> Start Position : {this.state.infoToDisplay[6]}</p>
                    <p> End Position : {this.state.infoToDisplay[7]}</p>
                    <p> Variant Reads : {this.state.infoToDisplay[0]} </p>
                    <p> Coverage : {this.state.infoToDisplay[1]}</p>
                  </div>

                  :

                  <div><p>No data to display for this timepoint</p></div>
                }
              </Panel>
              </Col>
              
              <Col xs={12} md={8}>
                <Panel>
                  <BootstrapTable
                      keyField='nb'
                      data={this.state.showCMData} 
                      version='4'
                      striped
                      expandableRow={this.isExpandableRow}
                      expandComponent={this.expandComponent.bind(this)}
                      search
                    >
                    <TableHeaderColumn dataField='nb'></TableHeaderColumn>
                    <TableHeaderColumn dataField='gA'>Gene A</TableHeaderColumn>
                    <TableHeaderColumn dataField='PosA'>Pos A</TableHeaderColumn>
                    <TableHeaderColumn dataField='chA'>Ch A</TableHeaderColumn>
                    <TableHeaderColumn dataField='gB'>Gene B</TableHeaderColumn>
                    <TableHeaderColumn dataField='PosB'>Pos B</TableHeaderColumn>
                    <TableHeaderColumn dataField='chB'>Ch B</TableHeaderColumn>
                    <TableHeaderColumn dataField='corrVal'>Corr Value</TableHeaderColumn>
                  </BootstrapTable>
                </Panel>
              </Col>
          </Row>
          <Row>
            <Modal show={this.state.show} onHide={this.handleClose} bsSize="medium">
              <Modal.Header closeButton>
                Correlation Matrix
              </Modal.Header>
                <Modal.Body>
                  <div id='MutMatrix'>
                    {this.state.show==true && (this.checkDivChildComponents('MutMatrix')==false && (
                      MutationMatrix(this.getListOfFreqByMutForAllSamples(this.props.mergedMutations))
                    ))}
                    <hr/>
                    </div>     
                  <div>
                    <div id="mutSlider">
                    <Slider dots step={20} defaultValue={100}/>
                    </div>
                    <hr/>
                    <Button
                      id="Comp_bt5"
                      onClick={this.displayListOfCorrelatedMutations.bind(this)}
                    >
                      Display List of Correlated Mutations
                    </Button>
                    <hr/>
                    
                  </div>
                </Modal.Body>
            </Modal>
          </Row>
        </Grid>
        </div>
      );
    }
}