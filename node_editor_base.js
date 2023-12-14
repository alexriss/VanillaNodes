function NodeFlowEditor(boardElement, boardWrapperElement) {
    this.boardElement = boardElement;
    this.boardWrapperElement = boardWrapperElement;

    this.grabbingBoard = false;
    this,grabbingNode = false;
    
    this.selectedNodes = new Set();
    this.clickedNodeInitialState = false;

    this.selectedEdge = null;
    this.selectedEdgeTemp = null;
    this.newEdge = null;
    this.newEdgeObj = null;

    this.insideInput = null;
    this.clickedPosition = { x: -1, y: -1 };
    
    this.nodes = [];
    this.edges = [];

    this.scale = 1;
    this.scaleMax = 5;

    this.maxZindex = 1;

    this.nodeTypes = {
        Output: {
                name: "Output",
                template: "nodeTemplateOutput",
                context: false,
                permanent: true,
            },
        "Add": {
                name: "Add",
                template: "nodeTemplateAdd",
            },
        "Average": {
                name: "Average",
                template: "nodeTemplateAverage",
            },
        "Math": {
                name: "Math",
                template: "nodeTemplateMath",
            },
        "Number": {
                name: "Number",
                template: "nodeTemplateNumber",
            },
    };

    boardElement.addEventListener(
        "wheel",
        (event) => {
            // Update scale
            this.scale += event.deltaY * -0.005;

            // Restrict scale
            this.scale = Math.min(Math.max(1, this.scale), this.scaleMax);

            // Apply scale transform
            boardElement.style.transform = `scale(${this.scale})`;
            boardElement.style.marginTop = `${(this.scale - 1) * 50}vh`;
            boardElement.style.marginLeft = `${(this.scale - 1) * 50}vw`;
        },
        { passive: false }
    );

    boardElement.addEventListener("mouseup", (e) => this.handleOnMouseUpBoard(e));
    boardElement.addEventListener("mousedown", (e) => this.handleOnMouseDownBoard(e));
    boardElement.addEventListener("mousemove", (e) => this.handleOnMouseMove(e));

    document.addEventListener("keydown", (e) => {
        if (e.key === "Delete") {
            for (const node of this.selectedNodes) {
                this.handleOnClickDelete(node, e);
            }
            if (this.selectedEdge !== null) {
                this.handleOnDeleteEdge(this.selectedEdge);
            }
            if (this.selectedEdgeTemp !== null) {
                this.handleOnDeleteEdge(this.selectedEdgeTemp);
            }
        }
    });

    this.setupMenu();
    this.addNode({type: "Output"}, 600, 600);
}


NodeFlowEditor.prototype = {
    setupMenu() {
        const structure = [];
        // iterate over nodetypes object key/value pairs
        for (let [key, value] of Object.entries(this.nodeTypes)) {
            const obj = {
                'onclick': (e) => this.handleOnClickAdd(e, key),
            }
            Object.assign(obj, this.nodeTypes[key]);
            structure.push(obj);
        }
        structure.push('divider');      
        structure.push({
            'name': 'Extra text',
        });

        const menuWrapper = document.getElementById('dropdown-menu-node-wrapper');
        this.contextMenu = new ContextMenu(this.boardElement, menuWrapper,  structure);
    },

    // Setters
    setGrabbingBoard(value) {
        this.grabbingBoard = value;
        if (value) {
            this.boardElement.classList.add("boardDragging");
            this.boardElement.classList.remove("board");
        } else {
            this.boardElement.classList.add("board");
            this.boardElement.classList.remove("boardDragging");
        }
    },

    setSelectedNodeId(id, unselect=true, switchState=false) {
        const node = this.nodes.find((node) => node.id === id);
        return this.setSelectedNode(node, unselect, switchState);
    },

    setSelectedNode(node, deselect=true, switchState=false) {
        if (node === null) {
            this.selectedNodes.clear();
        } else if (switchState && this.selectedNodes.has(node)) {
            this.selectedNodes.delete(node);
        } else {
            this.selectedNodes.add(node);
        }

        // deselect all other nodes
        if (deselect) {
            for (let i = 0; i < this.nodes.length; i++) {
                if (this.nodes[i] != node) {
                    this.selectedNodes.delete(this.nodes[i]);
                }
            }
        }

        // sync selected state
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.selectedNodes.has(this.nodes[i])) {
                this.nodes[i].setSelected(true);
            } else {
                this.nodes[i].setSelected(false);
            }
        }

        return node;
    },

    addNode(node, x=-1, y=-1) {
        if (x != -1 && y != -1) {
            node.prevPosition = { x: x, y: y };
            node.currPosition = { x: x, y: y };
        }

        if (!node.hasOwnProperty("id")) {
            const id = `node_${Math.random().toString(36).substring(2, 8)}`;
            node.id = id;
        }

        const nodeObj = new NodeFlowEditorNode(
            this.boardElement, this.boardWrapperElement,
            this.nodeTypes[node.type],
            {
                ...node,
                inputEdgeIds: [],
                outputEdgeIds: [],
                onMouseDownNode: (event) => this.handleOnMouseDownNode(node.id, event),
                onMouseUpNode: (event) => this.handleOnMouseUpNode(node.id, event),
                onClickDelete: (event) => this.handleOnClickDeleteId(node.id, event),
                onMouseDownOutput: (x, y, id, indO, indI) => this.handleOnMouseDownOutput(x, y, node.id, indO, indI),
                onMouseEnterInput: (x, y, id, indO, indI) => this.handleOnMouseEnterInput(x, y, node.id, indO, indI),
                onMouseLeaveInput: (id, indO, indI) => this.handleOnMouseLeaveInput(node.id, indO, indI),
            }
        )
        // Update global nodes array
        this.nodes.push(nodeObj);
    },

    addEdge(edge, cleanup=true) {
        // adds egde from loaded objects
        edge.id = `edge_${edge.nodeStartId}_${edge.nodeStartIndex}_${edge.nodeEndId}_${edge.nodeEndIndex}`;
        if (!edge.hasOwnProperty("position") || !edge.hasOwnProperty("currStartPosition") || !edge.hasOwnProperty("currEndPosition")) {
            const refOutput = this.nodes.find((node) => node.id === edge.nodeStartId).node.querySelectorAll(".outputNode")[edge.nodeStartIndex];
            const refInput = this.nodes.find((node) => node.id === edge.nodeEndId).node.querySelectorAll(".inputNode")[edge.nodeEndIndex];

            if (refOutput === undefined || refInput === undefined) {
                return;
            }

            const outputPositionX = refOutput.getBoundingClientRect().left + Math.abs(refOutput.getBoundingClientRect().right - refOutput.getBoundingClientRect().left) / 2;
            const outputPositionY = refOutput.getBoundingClientRect().top + Math.abs(refOutput.getBoundingClientRect().bottom - refOutput.getBoundingClientRect().top) / 2;
            const inputPositionX = refInput.getBoundingClientRect().left + Math.abs(refInput.getBoundingClientRect().right - refInput.getBoundingClientRect().left) / 2;
            const inputPositionY = refInput.getBoundingClientRect().top + Math.abs(refInput.getBoundingClientRect().bottom - refInput.getBoundingClientRect().top) / 2;

            edge.currStartPosition = {
                x: (outputPositionX + this.boardWrapperElement.scrollLeft) / this.scale,
                y: (outputPositionY + this.boardWrapperElement.scrollTop) / this.scale,
            };
            edge.currEndPosition = {
                x: (inputPositionX + this.boardWrapperElement.scrollLeft) / this.scale,
                y: (inputPositionY + this.boardWrapperElement.scrollTop) / this.scale,
            };

            edge.position = {
                x0: edge.currStartPosition.x,
                y0: edge.currStartPosition.y,
                x1: edge.currEndPosition.x,
                y1: edge.currEndPosition.y,
            };
        }

        // delete some leftover properties
        if (cleanup) {
            ["outputIndex", "inputIndex"].map((prop) => {
                if (edge.hasOwnProperty(prop)) {
                    delete edge[prop];
                }
            });
        }

        const nodeStart = this.nodes.find((node) => node.id === edge.nodeStartId);
        const nodeEnd = this.nodes.find((node) => node.id === edge.nodeEndId);

        // dont add edge if the nodes dont exist
        if (nodeStart === undefined || nodeEnd === undefined) {
            return;
        }

        // dont add the same edge twice
        if (nodeStart.outputEdgeIds.includes(edge.id) && nodeEnd.inputEdgeIds.includes(edge.id)) {
            return;
        }

        nodeStart.outputEdgeIds = [...nodeStart.outputEdgeIds, edge.id];
        nodeEnd.inputEdgeIds = [...nodeEnd.inputEdgeIds, edge.id];

        edge = {
            ...edge,
            onMouseDownEdge: () => this.handleOnMouseDownEdge(edge.id),
            onMouseOverEdge: () => this.handleOnMouseOverEdge(edge.id),
            onMouseLeaveEdge: () => this.handleOnMouseLeaveEdge(edge.id),
            onClickDelete: () => this.handleOnDeleteEdge(edge.id)
        }
        const edgeObj = new NodeFlowEditorEdge(this.boardWrapperElement, this.boardElement, edge);
        this.edges.push(edgeObj);
    },

    setNewEdge(edge) {
        this.newEdge = edge;
        const props = {
            isNew: true,
            selected: false,
            position: {
                x0: this.newEdge.currStartPosition.x,
                y0: this.newEdge.currStartPosition.y,
                x1: this.newEdge.currEndPosition.x,
                y1: this.newEdge.currEndPosition.y,
            },
        }
        Object.assign(props, this.newEdge);
        this.newEdgeObj = new NodeFlowEditorEdge(this.boardWrapperElement, this.boardElement, props);
    },

    removeNewEdge() {
        if (this.addEdgeObj !== null) {
            this.boardElement.removeChild(this.newEdgeObj.edge);
        }
        this.newEdge = null;
        this.newEdgeObj = null;
        this.setActiveInputs(); // set all active
    },

    deleteEdge(edge)  {
        this.boardElement.removeChild(edge.edge);
        this.edges = [...this.edges.filter((e) => edge.id !== e.id)];
    },

    updateEdges() {
        for (let i = 0; i < this.edges.length; i++) {
            if (this.edges[i].id == this.selectedEdge) {
                this.edges[i].selected = true;
            } else if (this.edges[i].id == this.selectedEdgeTemp) {
                this.edges[i].selected = true;
            } else {
                this.edges[i].selected = false;
            }
            this.edges[i].setStyle();
        }   
    },

    setNewEdgeCurrEndPosition(position) {
        this.newEdgecurrEndPosition = position;
        this.newEdgeObj.setPosition({
            x0: this.newEdge.currStartPosition.x,
            y0: this.newEdge.currStartPosition.y,
            x1: this.newEdgecurrEndPosition.x,
            y1: this.newEdgecurrEndPosition.y,
        });
    },

    setActiveInputs() {
        // set the specific inputs as active when creating a new edge
        if (this.newEdge === null) {
            for (let i=0; i<this.nodes.length; i++) {
                this.nodes[i].setActiveInputs(false, -1, true);
            }
        } else {
            const nodeId = this.newEdge.nodeStartId;
            const inverted = (this.newEdge.outputIndex == -1)
            const ind = inverted ? this.newEdge.inputIndex : this.newEdge.outputIndex;
            for (let i=0; i<this.nodes.length; i++) {
                if (this.nodes[i].id == nodeId) {
                    this.nodes[i].setActiveInputs(inverted, ind);
                } else {
                    this.nodes[i].setActiveInputs(inverted, -1);
                }
            }
        }
    },

    // Handlers
    handleOnMouseDownBoard(event) {
        this.contextMenu.hideMenu();

        // Deselect node
        this.setSelectedNode(null);

        // Deselect edge
        this.selectedEdge = null;
        this.updateEdges();

        // Start grabbing board
        this.setGrabbingBoard(true);
        this.clickedPosition = { x: event.x, y: event.y };
    },

    handleOnMouseUpBoard() {
        this.clickedPosition = { x: -1, y: -1 };

        // Stop grabbing board
        this.setGrabbingBoard(false);

        // If a new edge is being set and is not inside input
        if (this.newEdge !== null && this.insideInput === null) {
            this.removeNewEdge();
        }

        // If a new edge is being set and is inside input
        if (this.newEdge !== null && this.insideInput !== null) {
            let startId = this.newEdge.nodeStartId;
            let endId = this.insideInput.nodeId;
            let startIndex = this.newEdge.outputIndex;
            let endIndex = this.insideInput.inputIndex;
            if (this.newEdge.outputIndex == -1) {  // inverted edge
                [startId, endId] = [endId, startId];
                startIndex = this.insideInput.inputIndex;
                endIndex = this.newEdge.inputIndex;
            }

            // Add new edge
            edge = {
                nodeStartId: startId,
                nodeEndId: endId,
                nodeStartIndex: startIndex,
                nodeEndIndex: endIndex,
            }

            this.addEdge(edge);
            this.removeNewEdge();
        }
    },

    handleOnMouseMove(event) {
        // User clicked somewhere
        if (this.clickedPosition.x >= 0 && this.clickedPosition.y >= 0) {
            // User clicked on node
            if (this.selectedNodes.size > 0) {
                this.grabbingNode = true;
                const deltaX = event.x - this.clickedPosition.x;
                const deltaY = event.y - this.clickedPosition.y;

                for (const node of this.selectedNodes) {
                    // Update node position
                    node.setCurrPosition({
                        x: (node.prevPosition.x + deltaX) / this.scale,
                        y: (node.prevPosition.y + deltaY) / this.scale,
                    });

                    // Update input edges positions
                    for (let i = 0; i < node.inputEdgeIds.length; i++) {
                        const edgeId = node.inputEdgeIds[i];
                        const edge = this.edges.find((edge) => edge.id === edgeId);
                        if (edge) {
                            edge.setCurrEndPosition({
                                x: (edge.prevEndPosition.x + deltaX) / this.scale,
                                y: (edge.prevEndPosition.y + deltaY) / this.scale,
                            })
                        }
                    }

                    // Update output edges positions
                    for (let i = 0; i < node.outputEdgeIds.length; i++) {
                        const edgeId = node.outputEdgeIds[i];
                        const edge = this.edges.find((edge) => edge.id === edgeId);
                        if (edge) {
                            edge.setCurrStartPosition({
                                x: (edge.prevStartPosition.x + deltaX) / this.scale,
                                y: (edge.prevStartPosition.y + deltaY) / this.scale,
                            });
                        }
                    }
                }
            }

            // User clicked on board, move board
            else {
                const deltaX = event.x - this.clickedPosition.x;
                const deltaY = event.y - this.clickedPosition.y;

                this.boardWrapperElement.scrollBy(-deltaX, -deltaY);
                this.clickedPosition = { x: event.x, y: event.y };
            }
        }

        // User is setting new edge
        if (this.newEdge !== null) {
            this.setNewEdgeCurrEndPosition({
                x: (event.x + this.boardWrapperElement.scrollLeft) / this.scale,
                y: (event.y + +this.boardWrapperElement.scrollTop) / this.scale,
            });
        }
    },

    handleOnMouseDownNode(id, event) {
        // Prevent click on board
        event.stopPropagation();
        
        this.contextMenu.hideMenu();

        // Deselect edge
        this.selectedEdge = null;
        this.updateEdges();

        // Update first click position
        this.clickedPosition = { x: event.x, y: event.y };

        // Select node, deselection happens on mouseup
        const node = this.nodes.find((node) => node.id === id);
        this.clickedNodeInitialState = node.selected;
        let deselect = (event.ctrlKey || event.shiftKey) ? false : true;
        deselect = node.selected ? false : deselect;

        this.setSelectedNode(node, deselect, false);

        this.maxZindex++;
        for (const node of this.selectedNodes) {
            // Update node position
            node.setPrevPosition({
                x: node.currPosition.x * this.scale,
                y: node.currPosition.y * this.scale
            });

            // this node should go on top of the others
            node.setZindex(this.maxZindex);

            // Update input edges positions
            for (let i = 0; i < node.inputEdgeIds.length; i++) {
                const edgeId = node.inputEdgeIds[i];
                const edge = this.edges.find((edge) => edge.id === edgeId);
                if (edge) {
                    edge.setPrevEndPosition({
                        x: edge.currEndPosition.x * this.scale,
                        y: edge.currEndPosition.y * this.scale
                    });
                }
            }

            // Update output edges positions
            for (let i = 0; i < node.outputEdgeIds.length; i++) {
                const edgeId = node.outputEdgeIds[i];
                const edge = this.edges.find((edge) => edge.id === edgeId);
                if (edge) {
                    edge.setPrevStartPosition({
                        x: edge.currStartPosition.x * this.scale,
                        y: edge.currStartPosition.y * this.scale
                    });
                }
            }
        }
    },

    handleOnMouseUpNode(id, event) {
        if (!this.grabbingNode && this.newEdge === null) {
            const unselect = (event.ctrlKey || event.shiftKey) ? false : true;
            let switchState = (event.ctrlKey || event.shiftKey) ? true : false;
            switchState = this.clickedNodeInitialState ? switchState : false;
            this.setSelectedNodeId(id, unselect, switchState);
        }
        this.grabbingNode = false;
    },

    handleOnClickAdd(event, type) {
        // Positions taking into account scale and scroll
        const x = (event.x + this.boardWrapperElement.scrollLeft) / this.scale;
        const y = (event.y + this.boardWrapperElement.scrollTop) / this.scale;

        this.addNode({type: type}, x, y);
    },

    handleOnClickDeleteId(id, event) {
        const node = this.nodes.find((node) => node.id === id);
        this.handleOnClickDelete(node, event);
    },

    handleOnClickDelete(node, event) {
        event.stopPropagation();

        if (node.type.hasOwnProperty("permanent") && node.type.permanent) {
            return;
        }

        // Delete node edges
        const inputs = node.inputEdgeIds;
        const outputs = node.outputEdgeIds;

        // Get all unique edges to delete
        const allEdges = [...inputs, ...outputs];
        const uniqueEdges = allEdges.filter((value, index, array) => {
            return array.indexOf(value) === index;
        });

        // Delete edges from correspondent nodes data
        for (let i = 0; i < uniqueEdges.length; i++) {
            const edge = this.edges.find((edge) => edge.id === uniqueEdges[i]);
            if (edge) {
                const nodeStart = this.nodes.find((node) => node.id === edge.nodeStartId);
                const nodeEnd = this.nodes.find((node) => node.id === edge.nodeEndId);

                nodeStart.outputEdgeIds = [...nodeStart.outputEdgeIds.filter((edgeId) => edgeId !== uniqueEdges[i])];
                nodeEnd.inputEdgeIds = [...nodeEnd.inputEdgeIds.filter((edgeId) => edgeId !== uniqueEdges[i])];

                // Delete edge from global data
                this.deleteEdge(edge);
            }
        }

        // Delete node
        this.deleteNode(node);
    },

    handleOnMouseDownOutput(outputPositionX, outputPositionY, nodeId, outputIndex, inputIndex) {
        this.contextMenu.hideMenu();
        
        // Deselect node
        this.setSelectedNode(null);

        // Create edge position signals with updated scale value
        const prevEdgeStart = {
            x: (outputPositionX + this.boardWrapperElement.scrollLeft) / this.scale,
            y: (outputPositionY + this.boardWrapperElement.scrollTop) / this.scale,
        };
        const currEdgeStart = {
            x: (outputPositionX + this.boardWrapperElement.scrollLeft) / this.scale,
            y: (outputPositionY + this.boardWrapperElement.scrollTop) / this.scale,
        };
        const prevEdgeEnd = {
            x: (outputPositionX + this.boardWrapperElement.scrollLeft) / this.scale,
            y: (outputPositionY + this.boardWrapperElement.scrollTop) / this.scale,
        };
        const currEdgeEnd = {
            x: (outputPositionX + this.boardWrapperElement.scrollLeft) / this.scale,
            y: (outputPositionY + this.boardWrapperElement.scrollTop) / this.scale,
        };

        this.setNewEdge({
            id: "",
            nodeStartId: nodeId,
            outputIndex: outputIndex,
            inputIndex: inputIndex,
            nodeEndId: "",
            prevStartPosition: prevEdgeStart,
            currStartPosition: currEdgeStart,
            prevEndPosition: prevEdgeEnd,
            currEndPosition: currEdgeEnd,
        });

        this.setActiveInputs();
    },

    handleOnMouseEnterInput(inputPositionX, inputPositionY, nodeId, outputIndex, inputIndex) {
        // only connect input to output and output to input
        if (this.newEdge === null) {
            return;
        }
        if (this.newEdge.outputIndex >= 0 && inputIndex >= 0) {
            this.insideInput = { nodeId: nodeId, inputIndex: inputIndex, position: {x : inputPositionX, y: inputPositionY}};
        } else if (this.newEdge.inputIndex >=0 && outputIndex >= 0) {
            this.insideInput = { nodeId: nodeId, inputIndex: outputIndex, position: {x : inputPositionX, y: inputPositionY}};
        } else {
            this.insideInput = null;
        }
    },

    handleOnMouseLeaveInput(nodeId, inputIndex) {
        if (this.insideInput !== null && this.insideInput.nodeId === nodeId && this.insideInput.inputIndex === inputIndex) {
            this.insideInput = null;
        }
    },

    handleOnMouseDownEdge(edgeId) {
        this.contextMenu.hideMenu();
        
        // Deselect node
        this.setSelectedNode(null);

        // Select edge
        this.selectedEdge = edgeId;
        this.updateEdges();
    },

    handleOnMouseOverEdge(edgeId) {
        // Select edge
        if (this.newEdge === null) {
            this.selectedEdgeTemp = edgeId;
            this.updateEdges();
        }
    },

    handleOnMouseLeaveEdge(edgeId) {
        this.selectedEdgeTemp = null;
        this.updateEdges();
    },

    handleOnDeleteEdge(edgeId) {
        const edge = this.edges.find((e) => e.id === edgeId);

        if (edge) {
            // Delete edge from start node
            const nodeStart = this.nodes.find((n) => n.id === edge.nodeStartId);
            if (nodeStart) {
                nodeStart.outputEdgeIds = [...nodeStart.outputEdgeIds.filter((edgeId) => edgeId !== edge.id)];
            }

            // Delete edge from end node
            const nodeEnd = this.nodes.find((n) => n.id === edge.nodeEndId);
            if (nodeEnd) {
                nodeEnd.inputEdgeIds = [...nodeEnd.inputEdgeIds.filter((edgeId) => edgeId !== edge.id)];
            }

            // Delete edge from global edges array
            this.edges = [...this.edges.filter((e) => e.id !== edge.id)];
            this.deleteEdge(edge);
        }
    },

    deleteNode(node) {
        // Delete node from global nodes array
        this.nodes = [...this.nodes.filter((n) => n !== node)];
        this.selectedNodes.delete(node);

        // Delete node from board
        this.boardElement.removeChild(node.node);
    },

    exportData() {
        // export all the node and edge data
        const nodes = this.nodes.map((node) => {
            return {
                id: node.id,
                type: node.type,
                currPosition: node.currPosition,
                inputEdgeIds: node.inputEdgeIds,
                outputEdgeIds: node.outputEdgeIds,
            };
        });
        const edges = this.edges.map((edge) => {
            return {
                id: edge.id,
                nodeStartId: edge.nodeStartId,
                nodeEndId: edge.nodeEndId,
                nodeStartIndex: edge.nodeStartIndex,
                nodeEndIndex: edge.nodeEndIndex,
            };
        });
        return {nodes, edges};
    },

    loadData(data, clear=true) {
        // clear board
        if (clear) {
            while (this.nodes.length > 0) {
                this.deleteNode(this.nodes[0]);
            }
            while (this.edges.length > 0) {
                this.deleteEdge(this.edges[0]);
            }
        }
        // load from exported data
        if (data.hasOwnProperty("nodes")) {
            const nodes = data.nodes.map((node) => {
                return this.addNode(node);
            });
        }
        if (data.hasOwnProperty("edges")) {
            const edges = data.edges.map((edge) => {
                return this.addEdge(edge);
            });
        }
    }
}

function NodeFlowEditorNode(boardElement, boardWrapper, nodeType, props) {
    this.boardElement = boardElement;
    this.boardWrapper = boardWrapper;
    this.node = null;

    this.id = "";
    this.nodeType = nodeType;
    this.prevPosition = { x: 0, y: 0 };
    this.currPosition = { x: 0, y: 0 };
    this.numberInputs = 0;
    this.numberOutputs = 0;
    this.selected = false;
    this.zindex = 0;

    this.inputEdgeIds = [];
    this.outputEdgeIds = [];

    // merge props
    Object.assign(this, props);

    this.setCurrPosition(this.currPosition);
    this.setup();
}

NodeFlowEditorNode.prototype = {
    setup() {
        const tpl = this.boardWrapper.getElementsByClassName(this.nodeType.template)[0];
        const node = tpl.content.cloneNode(true);

        this.node = node.firstElementChild;
        this.node.style.transform = `translate(${this.currPosition.x}px, ${this.currPosition.y}px)`;
        this.node.addEventListener("mousedown", (e) => this.onMouseDownNode(e));
        this.node.addEventListener("mouseup", (e) => this.onMouseUpNode(e));
        this.node.style.zindex = this.zindex;

        // Inputs
        const inputs = node.querySelectorAll(".inputNode");
        for (let i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener("mouseenter", (e) => this.handleMouseEnterInput(inputs[i], -1, i));
            inputs[i].addEventListener("mouseleave", (e) => this.handleMouseLeaveInput(i));
            inputs[i].addEventListener("mousedown", (e) => this.handleMouseDownOutput(inputs[i], e, -1, i));
        }

        // Outputs
        const outputs = node.querySelectorAll(".outputNode");
        for (let i = 0; i < outputs.length; i++) {
            outputs[i].addEventListener("mouseenter", (e) => this.handleMouseEnterInput(outputs[i], i, -1));
            outputs[i].addEventListener("mouseleave", (e) => this.handleMouseLeaveInput(i));
            outputs[i].addEventListener("mousedown", (e) => this.handleMouseDownOutput(outputs[i], e, i, -1));
        }

        // Delete button
        const deleteButton = node.querySelector(".delete");
        if (this.nodeType.hasOwnProperty("permanent") && this.nodeType.permanent) {
            deleteButton.style.display = "none";
        } else {
            deleteButton.addEventListener("click", (e) => this.onClickDelete(e));
        }

        // Add node to board
        this.boardElement.appendChild(node);
    },

    // Setters
    setCurrPosition(position) {
        this.currPosition = { x: position.x, y: position.y };
        if (this.node !== null) {
            this.node.style.transform = `translate(${position.x}px, ${position.y}px)`;
        }
    },

    setPrevPosition(position) {
        this.prevPosition = { x: position.x, y: position.y };
    },

    setSelected(selected) {
        this.selected = selected;
        if (this.selected) {
            this.node.classList.add("nodeSelected");
        } else {
            this.node.classList.remove("nodeSelected");
        }
    },

    setZindex(zindex) {
        this.node.style.zIndex = zindex;
    },

    setActiveInputs(inverted=false, currOutputIndex=-1, allActive=false) {
        let inputs = this.node.querySelectorAll(".inputNode");
        let outputs = this.node.querySelectorAll(".outputNode");

        if (allActive) {
            for (let i = 0; i < inputs.length; i++) {
                inputs[i].classList.remove("disabled");
            }
            for (let i = 0; i < outputs.length; i++) {
                outputs[i].classList.remove("disabled");
            }
        } else {
            if (inverted) {
                [inputs, outputs] = [outputs, inputs];
            }

            for (let i = 0; i < inputs.length; i++) {
                if (currOutputIndex == -1) {
                    inputs[i].classList.remove("disabled");
                } else {  // the inputs of the current node should be inactive
                    inputs[i].classList.add("disabled");
                }
            }
            for (let i = 0; i < outputs.length; i++) {
                if (i == currOutputIndex) {
                    outputs[i].classList.remove("disabled");
                } else {
                    outputs[i].classList.add("disabled");
                }
            }
        }
    },

    // handlers
    handleMouseDownOutput(ref, event, outputIndex, inputIndex) {
        // Disable drag node
        event.stopPropagation();

        const centerX =
            ref.getBoundingClientRect().left + Math.abs(ref.getBoundingClientRect().right - ref.getBoundingClientRect().left) / 2;
        const centerY =
            ref.getBoundingClientRect().top + Math.abs(ref.getBoundingClientRect().bottom - ref.getBoundingClientRect().top) / 2;

        this.onMouseDownOutput(centerX, centerY, this.id, outputIndex, inputIndex);
    },

    handleMouseEnterInput(ref, outputIndex, inputIndex) {
        const centerX =
            ref.getBoundingClientRect().left + Math.abs(ref.getBoundingClientRect().right - ref.getBoundingClientRect().left) / 2;
        const centerY =
            ref.getBoundingClientRect().top + Math.abs(ref.getBoundingClientRect().bottom - ref.getBoundingClientRect().top) / 2;

        this.onMouseEnterInput(centerX, centerY, this.id, outputIndex, inputIndex);
    },

    handleMouseLeaveInput(inputIndex) {
        this.onMouseLeaveInput(this.id, inputIndex);
    }
}


function NodeFlowEditorEdge(boardWrapper, board, props) {
    this.boardWrapper = boardWrapper;
    this.board = board;
    this.edge = null;

    this.selected = false;
    this.isNew = false;
    this.position = { x0: 0, y0: 0, x1: 0, y1: 0 };

    this.outputIndex = -1;
    this.inputIndex = -1;

    // merge props
    Object.assign(this, props);

    const middleX = (this.position.x0 + this.position.x1) / 2;
    const middleY = (this.position.y0 + this.position.y1) / 2;
    this.middlePoint = { x: middleX, y: middleY };
    this.setup();
}

NodeFlowEditorEdge.prototype = {
    setup() {
        const tpl = this.boardWrapper.querySelector(".edgeTemplate");
        const edge = tpl.content.cloneNode(true);
        this.edge = edge.firstElementChild;

        this.path = edge.querySelector("path");
        this.deleteButton = edge.querySelector(".deleteButton");
        
        this.deleteButton.addEventListener("click", (e) => this.handleOnClickDelete(e));
        this.path.addEventListener("mousedown", (e) => this.handleOnMouseDownEdge(e));
        this.edge.addEventListener("mouseover", (e) => this.handleOnMouseOverEdge(e));
        this.edge.addEventListener("mouseleave", (e) => this.handleOnMouseLeaveEdge(e));

        this.setPosition(this.position);
        this.setSelectedNew(this.selected, this.isNew);

        this.setStyle();
        // Add edge to board
        this.board.appendChild(edge);
    },

    // Setters
    setStyle() {
        if (this.isNew) {
            this.path.classList.add("edgeNew");
            this.path.classList.remove("edge");
            this.path.classList.remove("edgeSelected");
        } else if (this.selected) {
            this.path.classList.add("edgeSelected");
            this.path.classList.remove("edge");
            this.path.classList.remove("edgeNew");
            this.deleteButton.classList.add("delete");
            this.deleteButton.classList.remove("deleteHidden");
        } else {
            this.path.classList.add("edge");
            this.path.classList.remove("edgeSelected");
            this.path.classList.remove("edgeNew");
            this.deleteButton.classList.add("deleteHidden");
            this.deleteButton.classList.remove("delete");
        }
    },

    setMiddlePoint() {
        let x = this.position.x0 + (this.position.x1 - this.position.x0) / 2;
        let y = this.position.y0 + (this.position.y1 - this.position.y0) / 2;

        this.middlePoint = { x: x, y: y };
        if (this.selected) {
            y -= 24;
        }
        this.deleteButton.setAttribute('transform', `translate(${x} ${y})`);
    },

    setSelectedNew(selected, isNew) {
        this.selected = selected;
        this.isNew = isNew;
        this.setStyle();
    },

    setCurrEndPosition(position) {
        this.currEndPosition = { x: position.x, y: position.y };
        this.setPosition({
            x0: this.currStartPosition.x,
            y0: this.currStartPosition.y,
            x1: this.currEndPosition.x,
            y1: this.currEndPosition.y,
        });
    },

    setCurrStartPosition(position) {
        this.currStartPosition = { x: position.x, y: position.y };
        this.setPosition({
            x0: this.currStartPosition.x,
            y0: this.currStartPosition.y,
            x1: this.currEndPosition.x,
            y1: this.currEndPosition.y,
        });
    },

    setPrevEndPosition(position) {
        this.prevEndPosition = { x: position.x, y: position.y };
    },

    setPrevStartPosition(position) {
        this.prevStartPosition = { x: position.x, y: position.y };
    },

    setPosition(position) {
        this.position = position;

        let offset = this.calculateOffset(Math.abs(position.x1 - position.x0));
        if (this.isNew && this.outputIndex == -1) {
            offset = -offset;
        }

        this.path.setAttribute("d", `
        M ${position.x0} ${position.y0} C ${
            position.x0 + offset
        } ${position.y0}, ${position.x1 - offset } ${
            position.y1
        }, ${position.x1} ${position.y1}`
        );

        this.setMiddlePoint();
    },

    // Give the edge a little offset so it curves
    calculateOffset(value) {
        return value / 2;
    },

    // Handlers
    handleOnMouseDownEdge(event) {
        // Disable click on board event
        event.stopPropagation();
        this.onMouseDownEdge();
    },

    handleOnMouseOverEdge(event) {
        this.onMouseOverEdge();
    },

    handleOnMouseLeaveEdge(event) {
        this.onMouseLeaveEdge();
    },

    handleOnClickDelete(event) {
        // Disable click on board event
        event.stopPropagation();
        this.onClickDelete();
    }

}
