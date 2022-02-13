// @ts-check
import util from 'util';
import {Heap,HeapValue} from './cHeap/Heap.mjs';

const COST = {
    NOT_FOUND:5000,
    SWITCH:80,
    MESSAGE:2
};
const CUTOFF_DISTANCE = 10;


class node{
    heapValue = undefined;
    switchEnabled = true;
    /**
     * @type {Array<{
     *      node:node,
     *      cost:number
     * }>}
     */
    neighbors = [];
    minCost = Infinity;
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

    /**
     * @type {Heap}
     */
    minHeap = undefined;

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

    dump(){
        return this.nodes.map(n=>(n.dump()))
    };
}

let g = new graph({nNode:1000,fieldX:30,fieldY:40});
g.reset();
console.log(`Inital cost: ${ g.calculateCost()}`);
console.log(util.inspect(g.dump(),{maxArrayLength:null,depth:null,showHidden:false}));

g.nodes.forEach(n=>{
    n.switchEnabled = false;
});

/** @type {Set<number>} */
let meshCandidates = new Set();
/** @type {Set<number>} */
let coveredNodes = new Set();
/** @type {Set<number>} */
let pendingNeibors = new Set();

meshCandidates.add(0);
g.nodes[0].neighbors.forEach(n=>{
    pendingNeibors.add(n.node.id);
});

while(pendingNeibors.size > 0)
{
    /** @type {Set<number>} */
    let newCoveredNodes = new Set();
    while(pendingNeibors.size > 0)
    {
        let mostCover = 0;
        let argMostCover = -1;
        meshCandidates.forEach(id=>{
            let cover = 0;
            let n = g.nodes[id];
            n.neighbors.forEach(nn=>{
                if(pendingNeibors.has(nn.node.id)){
                    cover++;
                }
            });
            if(cover > mostCover){
                mostCover = cover;
                argMostCover = id;
            }
        });
        let n = g.nodes[argMostCover];
        meshCandidates.delete(n.id);
        n.neighbors.forEach(nn=>{
            if(pendingNeibors.has(nn.node.id)){
                pendingNeibors.delete(nn.node.id);
                newCoveredNodes.add(nn.node.id);
                coveredNodes.add(nn.node.id);
            }
        });
        n.switchEnabled = true;
    }
    meshCandidates.clear();
    newCoveredNodes.forEach(id=>{
        let n = g.nodes[id];
        n.neighbors.forEach(nn=>{
            if(!coveredNodes.has(nn.node.id)){
                pendingNeibors.add(nn.node.id);
            }
        });
        meshCandidates.add(id);
    });
    newCoveredNodes.clear();
}

g.reset();
console.log(`Final cost: ${ g.calculateCost()}`);
console.log(util.inspect(g.dump(),{maxArrayLength:null,depth:null,showHidden:false}));

