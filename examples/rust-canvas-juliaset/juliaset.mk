all: wasm

export CRATE_DIR=./julia_set
export CRATE_NAME=julia_set
MAKE_TARGET=make -f ../wasm/bindgen.mk $@
wasm:
	$(MAKE_TARGET) 

clean:
	$(MAKE_TARGET)
