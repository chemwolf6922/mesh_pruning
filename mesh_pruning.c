#include "cHeap/heap.h"
#include <stdbool.h>
#include <stdio.h>
#include <time.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define COST_NOT_FOUND (5000)
#define COST_SWITCH (80)
#define COST_MESSAGE (2)
#define INIT_WEIGHT (1.5f)
#define CUTOFF_DISTANCE (10)
#define LEARNING_RATE (0.003f)

float sigmoid(float v)
{
    return 1.0f/(1.0f + expf(-v));
}

float randf()
{
    return (((float)rand())/((float)RAND_MAX));
}

typedef struct mesh_node_neighbor_s mesh_node_neighbor_t;

typedef struct mesh_node_s
{
    heap_value_handle_t heap_value;
    bool switch_enabled;
    bool last_switch_enabled;
    mesh_node_neighbor_t* neighbors;
    int num_neighbors;
    float min_cost;
    float weight;
    bool visited;
    float x;
    float y;
    int id;
} mesh_node_t;

struct mesh_node_neighbor_s
{
    mesh_node_t* node;
    float cost;
};

/* mesh node will be static, thus only init them here */
void mesh_node_init(mesh_node_t* node,int id,float x,float y)
{
    memset(node,0,sizeof(mesh_node_t));
    node->heap_value = NULL;
    node->switch_enabled = true;
    node->last_switch_enabled = true;
    node->neighbors = NULL;
    node->min_cost = INFINITY;
    node->weight = INIT_WEIGHT;
    node->visited = false;
    node->id = id;
    node->x = x;
    node->y = y;
}

/* free neighbors */
void mesh_node_deinit(mesh_node_t* node)
{
    if(node->neighbors != NULL)
    {
        free(node->neighbors);
        node->neighbors = NULL;
        node->num_neighbors = 0;
    }
}

void mesh_node_reset(mesh_node_t* node)
{
    /* the heap should be freed as a whole */
    node->heap_value = NULL;
    node->min_cost = INFINITY;
    node->visited = false;
}

void mesh_node_set_switch(mesh_node_t* node)
{
    node->last_switch_enabled = node->switch_enabled;
    node->switch_enabled = sigmoid(node->weight) >= randf();
}

void mesh_node_visit_neighbors(mesh_node_t* node,heap_handle_t min_heap)
{
    if(node->switch_enabled){
        for(int i=0;i<node->num_neighbors;i++)
        {
            mesh_node_neighbor_t* neighbor = &(node->neighbors)[i];
            if(!neighbor->node->visited)
            {
                float new_cost = node->min_cost + neighbor->cost;
                if(new_cost < neighbor->node->min_cost)
                {
                    neighbor->node->min_cost = new_cost;
                    if(neighbor->node->heap_value == NULL)
                        neighbor->node->heap_value = heap_add(min_heap,neighbor->node);
                    else
                        heap_update(min_heap,neighbor->node->heap_value);
                }
            }
        }
    }
    node->visited = true;
}

void mesh_node_update_weight(mesh_node_t* node,float delta)
{
    if(node->switch_enabled != node->last_switch_enabled)
        node->weight += delta * (node->switch_enabled?-1.0f:1.0f);
}

void mesh_node_dump(mesh_node_t* node)
{
    printf("id:%d,\tmin cost:%.0f,\tswitch enabled:%s\n",
            node->id,node->min_cost,node->switch_enabled?"Y":"N");
}

float mesh_node_get_dis(mesh_node_t* A,mesh_node_t* B)
{
    return sqrtf(powf(A->x-B->x,2)+powf(A->y-B->y,2));
}

float mesh_node_dis_to_cost(float d)
{
    return roundf(d*5.0f+30.0f);
}

typedef struct
{
    mesh_node_t* nodes;
    int n_node;
    heap_handle_t min_heap;
} mesh_graph_t;

mesh_graph_t* mesh_graph_new(int n_node,float x,float y)
{
    mesh_graph_t* graph = malloc(sizeof(mesh_graph_t));
    if(!graph)
        goto fail;
    /* min heap is inited on use, not here. */
    graph->min_heap = NULL;
    graph->n_node = n_node;
    graph->nodes = malloc(sizeof(mesh_node_t)*n_node);
    if(!graph->nodes)
        goto fail;
    srand(time(NULL));
    int i = 0;
    mesh_node_init(&graph->nodes[i],i,0,0);
    i++;
    for(;i<n_node;i++)
    {
        mesh_node_init(&graph->nodes[i],i,(randf()-0.5f)*x,(randf()-0.5f)*y);
    }
    for(i=0;i<n_node;i++)
    {
        mesh_node_t* A = &graph->nodes[i];
        for(int j=0;j<n_node;j++)
        {
            mesh_node_t* B = &graph->nodes[j];
            if(i != j)
            {
                float d = mesh_node_get_dis(A,B);
                if(d < CUTOFF_DISTANCE)
                {
                    float cost = mesh_node_dis_to_cost(d);
                    if(!(i==0||j==0))
                        cost += COST_SWITCH;
                    A->num_neighbors ++;
                    A->neighbors = realloc(A->neighbors,sizeof(mesh_node_neighbor_t)*A->num_neighbors);
                    if(!A->neighbors)
                        exit(1);
                    mesh_node_neighbor_t* neighbor = &(A->neighbors)[A->num_neighbors-1];
                    neighbor->cost = cost;
                    neighbor->node = B;
                }
            }
        }
    }
    return graph;
fail:
    exit(1);
    return NULL;
}

void mesh_graph_free(mesh_graph_t* graph)
{
    if(!graph)
        return;
    if(graph->min_heap)
    {
        heap_free(graph->min_heap,NULL,NULL);
        graph->min_heap = NULL;
    }
    if(graph->nodes)
    {
        for(int i=0;i<graph->n_node;i++)
            mesh_node_deinit(&graph->nodes[i]);
        free(graph->nodes);
        graph->nodes = NULL;
    }
    free(graph);
}

void mesh_graph_reset(mesh_graph_t* graph)
{
    for(int i=0;i<graph->n_node;i++)
        mesh_node_reset(&graph->nodes[i]);
    graph->nodes[0].min_cost = 0;
}

void mesh_graph_set_switch(mesh_graph_t* graph, bool force_enable)
{
    if(force_enable)
    {
        for(int i=0;i<graph->n_node;i++)
            graph->nodes[i].switch_enabled = true;
    }
    else
    {
        for(int i=0;i<graph->n_node;i++)
            mesh_node_set_switch(&graph->nodes[i]);
    }
    graph->nodes[0].switch_enabled = true;
}

bool mesh_node_cost_compare(void* A,void* B)
{
    mesh_node_t* node_A = A;
    mesh_node_t* node_B = B;
    return node_A->min_cost > node_B->min_cost;
}

float mesh_graph_get_cost(mesh_graph_t* graph)
{
    float total_cost = 0.0f;
    if(graph->min_heap)
        heap_free(graph->min_heap,NULL,NULL);
    graph->min_heap = heap_create(mesh_node_cost_compare);
    if(!graph->min_heap)
        goto fail;
    
    mesh_node_t* n = &graph->nodes[0];
    for(;;)
    {
        mesh_node_visit_neighbors(n,graph->min_heap);
        n = heap_pop(graph->min_heap);
        if(!n)
            break;
    }
    float path_cost = 0.0f;
    for(int i=0;i<graph->n_node;i++)
    {
        float node_cost = graph->nodes[i].min_cost;
        if(isinff(node_cost))
            node_cost = COST_NOT_FOUND;
        path_cost += node_cost;
    }
        
    path_cost /= graph->n_node;
    int n_switch = 0;
    for(int i=0;i<graph->n_node;i++)
        n_switch += graph->nodes[i].switch_enabled;
    float msg_cost = ((float)n_switch) * COST_MESSAGE;
    total_cost = path_cost + msg_cost;

    return total_cost;
fail:
    exit(1);
    return NAN;
}

void mesh_graph_update_weight(mesh_graph_t* graph, float delta)
{
    for(int i=0;i<graph->n_node;i++)
        mesh_node_update_weight(&graph->nodes[i],delta);
}

void mesh_graph_dump(mesh_graph_t* graph)
{
    for(int i=0;i<graph->n_node;i++)
        mesh_node_dump(&graph->nodes[i]);
}

int main(int argc, char const *argv[])
{
    mesh_graph_t* g = mesh_graph_new(1000,30,40);
    
    mesh_graph_reset(g);
    mesh_graph_set_switch(g,true);
    float last_cost = mesh_graph_get_cost(g);
    mesh_graph_dump(g);
    printf("Initial cost: %.2f\n",last_cost);

    for(int i=0;i<20000;i++)
    {
        mesh_graph_reset(g);
        mesh_graph_set_switch(g,false);
        float new_cost = mesh_graph_get_cost(g);
        printf("Round %d cost: %.2f\n",i,new_cost);
        float delta = (new_cost - last_cost)*LEARNING_RATE;
        last_cost = new_cost;
        mesh_graph_update_weight(g,delta);
    }

    mesh_graph_dump(g);

    mesh_graph_free(g);
    return 0;
}
