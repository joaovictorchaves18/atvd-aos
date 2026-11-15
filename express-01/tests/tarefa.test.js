import test from "node:test";
import assert from "node:assert/strict";
import {
  createTarefaSchema,
  updateTarefaSchema,
  tarefaIdParamSchema,
} from "../src/middlewares/validationSchemas.js";
import AppError from "../src/utils/appError.js";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
}

const { default: models } = await import("../src/models/index.js");
const { default: tarefaService } = await import(
  "../src/services/tarefaService.js"
);
const { default: tarefaController } = await import(
  "../src/controllers/tarefaController.js"
);

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const createMockResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
});

// -------------------------------------------------------------
// Zod Schemas de Tarefa
// -------------------------------------------------------------
test("Tarefa - createTarefaSchema: aceita descricao válida com concluida padrão false", () => {
  const result = createTarefaSchema.safeParse({
    body: { descricao: "  Estudar Express e Zod  " },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.body.descricao, "Estudar Express e Zod");
  assert.equal(result.data.body.concluida, false);
});

test("Tarefa - createTarefaSchema: aceita concluida explícito como true", () => {
  const result = createTarefaSchema.safeParse({
    body: { descricao: "Finalizar atividade", concluida: true },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.body.concluida, true);
});

test("Tarefa - createTarefaSchema: rejeita ausência ou string vazia de descricao", () => {
  const missing = createTarefaSchema.safeParse({ body: {} });
  assert.equal(missing.success, false);

  const blank = createTarefaSchema.safeParse({ body: { descricao: "   " } });
  assert.equal(blank.success, false);
});

test("Tarefa - createTarefaSchema: rejeita concluida com tipo não booleano", () => {
  const result = createTarefaSchema.safeParse({
    body: { descricao: "Tarefa", concluida: "sim" },
  });
  assert.equal(result.success, false);
});

test("Tarefa - updateTarefaSchema: permite atualizar apenas descricao, apenas concluida ou ambos", () => {
  const onlyDesc = updateTarefaSchema.safeParse({
    body: { descricao: "  Nova descrição  " },
  });
  assert.equal(onlyDesc.success, true);
  assert.equal(onlyDesc.data.body.descricao, "Nova descrição");

  const onlyDone = updateTarefaSchema.safeParse({
    body: { concluida: true },
  });
  assert.equal(onlyDone.success, true);
  assert.equal(onlyDone.data.body.concluida, true);

  const both = updateTarefaSchema.safeParse({
    body: { descricao: "Atualizada", concluida: false },
  });
  assert.equal(both.success, true);
});

test("Tarefa - updateTarefaSchema: rejeita payload vazio", () => {
  const result = updateTarefaSchema.safeParse({ body: {} });
  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((i) =>
      i.message.includes("Ao menos um campo (descricao ou concluida)")
    ),
    true
  );
});

test("Tarefa - tarefaIdParamSchema: aceita UUID válido e rejeita inválido", () => {
  const valid = tarefaIdParamSchema.safeParse({
    params: { objectId: VALID_UUID },
  });
  assert.equal(valid.success, true);

  const invalid = tarefaIdParamSchema.safeParse({
    params: { objectId: "nao-eh-uuid" },
  });
  assert.equal(invalid.success, false);
});

// -------------------------------------------------------------
// Model Tarefa
// -------------------------------------------------------------
test("Tarefa - model: possui chave primária objectId UUIDv4 e concluida default false", () => {
  const attrs = models.Tarefa.getAttributes();
  assert.ok(attrs.objectId);
  assert.equal(attrs.objectId.primaryKey, true);
  assert.equal(attrs.descricao.allowNull, false);
  assert.equal(attrs.concluida.defaultValue, false);
});

// -------------------------------------------------------------
// tarefaService & tarefaController
// -------------------------------------------------------------
test("Tarefa - controller CRUD: cria, lista, busca, atualiza e remove tarefa", async (t) => {
  const sampleTask = {
    objectId: VALID_UUID,
    descricao: "Deploy na Vercel",
    concluida: false,
  };

  t.mock.method(tarefaService, "criarTarefa", async (payload) => ({
    objectId: VALID_UUID,
    ...payload,
  }));
  t.mock.method(tarefaService, "listarTarefas", async () => [sampleTask]);
  t.mock.method(tarefaService, "buscarTarefaPorId", async (id) =>
    id === VALID_UUID ? sampleTask : null
  );
  t.mock.method(tarefaService, "atualizarTarefa", async (id, payload) =>
    id === VALID_UUID ? { ...sampleTask, ...payload } : null
  );
  t.mock.method(
    tarefaService,
    "removerTarefa",
    async (id) => id === VALID_UUID
  );

  // POST /tarefas
  const createRes = createMockResponse();
  await tarefaController.criarTarefa(
    { body: { descricao: "Deploy na Vercel", concluida: false } },
    createRes
  );
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.objectId, VALID_UUID);

  // GET /tarefas
  const listRes = createMockResponse();
  await tarefaController.listarTarefas({}, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.length, 1);

  // GET /tarefas/:objectId
  const getRes = createMockResponse();
  await tarefaController.buscarTarefa(
    { params: { objectId: VALID_UUID } },
    getRes
  );
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.objectId, VALID_UUID);

  // PUT /tarefas/:objectId
  const updateRes = createMockResponse();
  await tarefaController.atualizarTarefa(
    { params: { objectId: VALID_UUID }, body: { concluida: true } },
    updateRes
  );
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.body.concluida, true);

  // DELETE /tarefas/:objectId
  const deleteRes = createMockResponse();
  await tarefaController.removerTarefa(
    { params: { objectId: VALID_UUID } },
    deleteRes
  );
  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.body.message, "Tarefa removida com sucesso.");
});

test("Tarefa - controller: lança AppError 404 quando objectId não é encontrado", async (t) => {
  t.mock.method(tarefaService, "buscarTarefaPorId", async () => null);
  t.mock.method(tarefaService, "atualizarTarefa", async () => null);
  t.mock.method(tarefaService, "removerTarefa", async () => false);

  await assert.rejects(
    () =>
      tarefaController.buscarTarefa(
        { params: { objectId: VALID_UUID } },
        createMockResponse()
      ),
    (err) => err instanceof AppError && err.statusCode === 404
  );

  await assert.rejects(
    () =>
      tarefaController.atualizarTarefa(
        { params: { objectId: VALID_UUID }, body: { concluida: true } },
        createMockResponse()
      ),
    (err) => err instanceof AppError && err.statusCode === 404
  );

  await assert.rejects(
    () =>
      tarefaController.removerTarefa(
        { params: { objectId: VALID_UUID } },
        createMockResponse()
      ),
    (err) => err instanceof AppError && err.statusCode === 404
  );
});
