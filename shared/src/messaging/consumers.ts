// RabbitMQ message consumer
// Handles consuming and processing events from message queues

import * as amqp from 'amqplib'
import logger from '../config/logger.js'
import { ServiceEvent } from './events.js'

export interface MessageConsumerConfig {
  url: string
  queue: string
  exchange: string
  prefetch?: number
  retryAttempts?: number
  retryDelay?: number
}

export interface MessageHandler {
  (event: ServiceEvent): Promise<void>
}

export class MessageConsumer {
  private config: MessageConsumerConfig
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null
  private connected: boolean = false

  constructor(config: MessageConsumerConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      logger.info(`Connecting to RabbitMQ: ${this.config.url}`)
      this.connection = (await amqp.connect(this.config.url)) as any
      this.channel = await (this.connection as any).createChannel()

      if (this.config.prefetch && this.channel) {
        await this.channel.prefetch(this.config.prefetch)
      }

      // Assert exchange
      if (this.channel) {
        await this.channel.assertExchange(this.config.exchange, 'direct', { durable: true })
      }

      // Assert queue
      if (this.channel) {
        await this.channel.assertQueue(this.config.queue, { durable: true })
      }

      // Bind queue to exchange
      if (this.channel) {
        await this.channel.bindQueue(this.config.queue, this.config.exchange, this.config.queue)
      }

      this.connected = true
      logger.info(
        `✅ Connected to RabbitMQ - queue: ${this.config.queue}, exchange: ${this.config.exchange}`,
      )
    } catch (error: any) {
      logger.error('❌ Failed to connect to RabbitMQ:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close()
      }
      if (this.connection) {
        await (this.connection as any).close()
      }
      this.connected = false
      logger.info('✅ Disconnected from RabbitMQ')
    } catch (error: any) {
      logger.error('Error disconnecting from RabbitMQ:', error)
    }
  }

  async consume(handler: MessageHandler): Promise<void> {
    if (!this.connected || !this.channel) {
      throw new Error('Consumer not connected')
    }

    try {
      await this.channel.consume(this.config.queue, async msg => {
        if (msg && this.channel) {
          try {
            const event: ServiceEvent = JSON.parse(msg.content.toString())
            logger.info(`📨 Received event: ${event.eventType}`)
            await handler(event)
            this.channel.ack(msg)
            logger.debug('✅ Message acknowledged')
          } catch (error: any) {
            logger.error('❌ Error processing message:', error)
            this.channel.nack(msg, false, false)
          }
        }
      })

      logger.info(`👂 Consumer listening on queue: ${this.config.queue}`)
    } catch (error: any) {
      logger.error('Error setting up consumer:', error)
      throw error
    }
  }

  async acknowledgeMessage(message: amqp.ConsumeMessage): Promise<void> {
    if (this.channel) {
      this.channel.ack(message)
      logger.debug('✅ Message acknowledged')
    }
  }

  async rejectMessage(message: amqp.ConsumeMessage, requeue: boolean = false): Promise<void> {
    if (this.channel) {
      this.channel.nack(message, false, requeue)
      logger.debug(`❌ Message rejected, requeue: ${requeue}`)
    }
  }
}

export const initializeConsumer = async (
  config: MessageConsumerConfig,
): Promise<MessageConsumer> => {
  const consumer = new MessageConsumer(config)
  await consumer.connect()
  return consumer
}
