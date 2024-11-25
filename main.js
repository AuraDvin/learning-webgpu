import { mat4 } from "./glm.js";
const format = 'rgba8unorm'

// Initialize WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('webgpu');
ctx.configure({
    device,
    format,
});

// Load shaders
const code = await fetch('shader.wgsl').then(res => res.text());
const module = device.createShaderModule({ code });

// Create vertex buffer layout
const vertexBufferLayout = {
    arrayStride: 32,
    attributes: [
        {
            offset: 0,
            format: 'float32x4',
            shaderLocation: 0,
        },
        {
            offset: 16,
            format: 'float32x4',
            shaderLocation: 1,
        },
    ]
};


// Create render pipeline
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        buffers: [vertexBufferLayout]
    },
    fragment: {
        module,
        targets: [{ format, }]
    },
    // conf globinske slike
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
    },
    layout: 'auto',
});


//Create depth texture 
const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'depth24plus', // globaina 24bitov (verjetno uresnic 32 -> it's a gpu thing)
});


// Prepare color texture 
// 1. fetch the texture from the server
const texture = await fetch('base.png').then(response => response.blob());



// Create vertex buffers 
const vertices = new Float32Array([
    // position      // colors   // indicies
    -1, -1, -1, 1,   /*Color: */  1, 0, 0, 1, // 0
    1,  -1, -1, 1,   /*Color: */  0, 1, 0, 1, // 1
    -1,  1, -1, 1,   /*Color: */  0, 0, 1, 1, // 2
    1,   1, -1, 1,   /*Color: */  1, 1, 0, 1, // 3

    -1, -1, 1, 1,   /*Color: */  1, 0, 0, 1, // 0
    1,  -1, 1, 1,   /*Color: */  0, 1, 0, 1, // 1
    -1,  1, 1, 1,   /*Color: */  0, 0, 1, 1, // 2
    1,   1, 1, 1,   /*Color: */  1, 1, 0, 1, // 3


]);

const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, 0, vertices);

// Create index buffer 
const indices = new Uint32Array([ // 2 trikotnika na vrstico -> ploskev kocke
    0, 1, 2, 1, 2, 3,
    0, 1, 4, 1, 4, 5,
    0, 2, 4, 2, 4, 6,
    1, 5, 3, 5, 3, 7,
    2, 3, 6, 3, 6, 7,
    4, 5, 6, 5, 6, 7,
]);

const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(indexBuffer, 0, indices);

// Create uniform buffer
const uniform = device.createBuffer({
    size: 4 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});


// Create Bind group 
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{
        binding: 0,
        resource: { buffer: uniform, },
    },],
});

function render() {
    const time = performance.now() / 1000;
    const modelMatrix = mat4.create().rotateX(time * 0.7).rotateY(time);
    const viewMatrix = mat4.create().translate([0, 0, 5]).invert();
    const projectionMatrix = mat4.create().perspectiveZO(1, 1, 0.01, 100);

    const matrix = mat4.create()
        .multiply(projectionMatrix)
        .multiply(viewMatrix)
        .multiply(modelMatrix);

    // animate 
    device.queue.writeBuffer(uniform, 0, matrix);

    // Create Command Encoder
    const commandEncoder = device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
        //config
        colorAttachments: [{
            view: ctx.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: [1, 1, 1, 1],
            storeOp: 'store',
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadOp: 'clear',
            depthClearValue: 1,
            depthStoreOp: 'discard',
        },
    });

    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
    renderPass.setBindGroup(0, bindGroup);
    renderPass.drawIndexed(indices.length);
    renderPass.end();

    const commandBuffer = commandEncoder.finish();

    // Submit Commands
    device.queue.submit([commandBuffer]);
    requestAnimationFrame(render);
}
requestAnimationFrame(render);