import type { AgentTurnOutput, AgentTurnPersistence } from './types'

export type PersistTurn = AgentTurnPersistence

export type PersistTurnRecord = Parameters<AgentTurnPersistence['persist']>[0]

export class NoOpPersistTurn implements AgentTurnPersistence {
  async persist(): Promise<void> {}
}

export class StoragePersistTurn implements AgentTurnPersistence {
  constructor(private readonly save: (record: PersistTurnRecord) => Promise<void>) {}

  async persist(record: PersistTurnRecord): Promise<void> {
    await this.save(record)
  }
}

export class InMemoryPersistTurn implements AgentTurnPersistence {
  readonly turns: AgentTurnOutput[] = []

  async persist(args: PersistTurnRecord): Promise<void> {
    this.turns.push(args.output)
  }
}
