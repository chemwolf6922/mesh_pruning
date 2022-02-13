CFLAGS?=-O3
DYN_LIBS=-lm

.PHONY:all

all:mesh_pruning_ml

cHeap/libheap.a:
	$(MAKE) -C cHeap lib

mesh_pruning_ml:mesh_pruning.o cHeap/libheap.a
	$(CC) $(CFLAGS) -o $@ $^ $(DYN_LIBS) 

.PHONY:clean
clean:
	$(MAKE) -C cHeap clean
	rm -f *.o
	rm -f mesh_pruning_ml