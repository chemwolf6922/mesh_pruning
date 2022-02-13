// @ts-check
import util from 'util';
import { Heap, HeapValue } from './cHeap/Heap.mjs';

const COST = {
    NOT_FOUND:5000,
    SWITCH:80,
    MESSAGE:2
};
const INIT_WEIGHT = 1.5;
const CUTOFF_DISTANCE = 10;
 
const LEARNING_RATE = 0.003;

class node{
    heapValue = undefined;
    switchEnabled = true;
    lastSwitchEnabled = true;
    /**
     * @type {Array<{
     *      node:node,
     *      cost:number
     * }>}
     */
    neighbors = [];
    minCost = Infinity;
    weight = INIT_WEIGHT;
    visited = false;
    /**
     * 
     * @param {{
     *      coordination:{
     *          x:number,
     *          y:number
     *      },
     *      id:number
     * }} params 
     */
    constructor(params) {
        this.coordination = params.coordination;
        this.id = params.id;
    }

    reset(){
        this.heapValue = undefined;
        this.minCost = Infinity;
        this.visited = false;
    }

    setSwitch(){
        this.lastSwitchEnabled = this.switchEnabled;
        this.switchEnabled = this.sigmoid(this.weight) >= Math.random();
    }

    /**
     * @param {Heap} minHeap
     */
    visitNeighbors(minHeap){
        if(this.switchEnabled){
            this.neighbors.forEach(n=>{
                if(!n.node.visited){
                    let newCost = this.minCost + n.cost;
                    if(newCost < n.node.minCost){
                        n.node.minCost = newCost;
                        if(n.node.heapValue === undefined){
                            n.node.heapValue = new HeapValue(n.node);
                            minHeap.add(n.node.heapValue);
                        }else{
                            minHeap.adjust(n.node.heapValue);
                        }
                    }
                }
            });
        }
        this.visited = true;
    }

    /**
     * @param {number} delta <0 if cost is reduced 
     * if delta < 0 && switchEnabled, increase weight
     */
    updateWeight(delta){
        if(this.switchEnabled !== this.lastSwitchEnabled){
            this.weight += delta * (this.switchEnabled?-1:1);
        }
    }

    /**
     * @param {number} v 
     */
    sigmoid(v){
        return 1/(1+Math.exp(-v));
    }

    dump(){
        return {
            id:this.id,
            minCost:this.minCost,
            switchEnabled:this.switchEnabled,
        };
    }
}

class graph{
    /**
     * @type {Array<node>}
     */
    nodes = [];

    minHeap = new Heap(/** @param {node} A @param {node} B */(A,B)=>A.minCost>B.minCost);

    /**
     * 
     * @param {{
     *      nNode:number,
     *      fieldX:number,
     *      fieldY:number
     * }} params 
     */
    constructor(params){
        this.nodes.push(new node({
            id:0,
            coordination:{x:0,y:0}
        }));
        for(let i = 1;i<params.nNode;i++){
            this.nodes.push(new node({
                id:i,
                coordination:{
                    x:Math.random()*params.fieldX-params.fieldX/2,
                    y:Math.random()*params.fieldY-params.fieldY/2
                }
            }));
        }
        /** init neighbors */
        this.nodes.forEach(A=>{
            this.nodes.forEach(B=>{
                if(A.id !== B.id){
                    let d = this.getNodeDistance(A,B);
                    if(d < CUTOFF_DISTANCE){
                        let cost = this.distanceToCost(d);
                        if(!(A.id===0 || B.id===0)){
                            cost += COST.SWITCH;
                        }
                        A.neighbors.push({
                            node:B,
                            cost:cost
                        });
                    }
                }
            });
        });
    };

    /**
     * @param {node} A 
     * @param {node} B 
     */
    getNodeDistance(A,B) {
        return Math.sqrt((A.coordination.x-B.coordination.x)**2 + (A.coordination.y-B.coordination.y)**2);
    };

    /**
     * @param {number} d
     */
    distanceToCost(d){
        return (d*5+30) >>> 0;
    };

    /**
     * @returns {node | undefined}
     */
    getNextNodeToVisit(){
        let v = this.minHeap.pop()?.value;
        return v;
    }

    reset(){
        this.nodes.forEach(n=>{n.reset();});
        /** always set root cost to 0 */
        this.nodes[0].minCost = 0;
    }

    /**
     * @param {boolean} [forceEnable] 
     */
    setSwitch(forceEnable){
        if(forceEnable === true){
            this.nodes.forEach(n=>{n.switchEnabled = true});
        }else{
            this.nodes.forEach(n=>{n.setSwitch();});
        }
        /** always enable switch for the root */
        this.nodes[0].switchEnabled = true;
    }

    calculateCost(){
        this.minHeap = new Heap(/** @param {node} A @param {node} B */(A,B)=>A.minCost>B.minCost);
        let n = this.nodes[0];
        do {
            n.visitNeighbors(this.minHeap);
        } while ((n = this.getNextNodeToVisit())!==undefined);
        let pathCost = 0;
        this.nodes.forEach(n=>{
            pathCost += n.minCost===Infinity?COST.NOT_FOUND:n.minCost;
        });
        pathCost /= this.nodes.length;
        let nSwitch = 0;
        this.nodes.forEach(n=>{
            nSwitch += n.switchEnabled?1:0;
        });
        let msgCost = nSwitch*COST.MESSAGE;
        return pathCost + msgCost;
    }

    /**
     * @param {number} delta 
     */
    updateWeight(delta){
        this.nodes.forEach(n=>{n.updateWeight(delta);});
    }

    dump(){
        return this.nodes.map(n=>(n.dump()))
    };
}

/** @type {number} */
let lastCost = undefined;
let g = new graph({nNode:1000,fieldX:30,fieldY:40});
g.reset();
g.setSwitch(true);
lastCost = g.calculateCost();
console.log(`Inital cost: ${lastCost}`);

console.log(util.inspect(g.dump(),{maxArrayLength:null,depth:null,showHidden:false}));

for(let i=0;i<20000;i++){
    g.reset();
    g.setSwitch();
    let newCost = g.calculateCost();
    console.log(`Round ${i} cost: ${newCost}`);
    let delta = (newCost-lastCost)*LEARNING_RATE;
    lastCost = newCost;
    g.updateWeight(delta);
}


console.log(util.inspect(g.dump(),{maxArrayLength:null,depth:null,showHidden:false}));
