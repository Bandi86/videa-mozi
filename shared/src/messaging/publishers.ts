// RabbitMQ message publisher
// Handles publishing events to message queues

import * as amqp from 'amqplib'
import logger from '../config/logger.js'
import { ServiceEvent, EVENT_ROUTES } from './events.js'

export interface MessagePublisherConfig {
  url: string
  exchange: string
  exchangeType: string
}

export class MessagePublisher {
  private config: MessagePublisherConfig
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null
  private connected: boolean = false

  constructor(config: MessagePublisherConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    try {
      logger.info(`Connecting to RabbitMQ: ${this.config.url}`)
      this.connection = (await amqp.connect(this.config.url)) as any
      this.channel = await (this.connection as any).createChannel()

      // Assert exchange
      if (this.channel) {
        await this.channel.assertExchange(this.config.exchange, this.config.exchangeType as any, {
          durable: true,
        })
      }

      this.connected = true
      logger.info(`✅ Connected to RabbitMQ - exchange: ${this.config.exchange}`)
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

  async publish(event: ServiceEvent): Promise<void> {
    if (!this.connected || !this.channel) {
      throw new Error('Publisher not connected')
    }

    try {
      const message = JSON.stringify(event)
      await this.channel.publish(this.config.exchange, event.eventType, Buffer.from(message), {
        persistent: true,
      })
      logger.info(`📤 Published event: ${event.eventType}`)
    } catch (error: any) {
      logger.error('❌ Failed to publish event:', error)
      throw error
    }
  }

  getTargetServices(eventType: string): string[] {
    const routes = EVENT_ROUTES[eventType as keyof typeof EVENT_ROUTES]
    return routes ? [...routes] : []
  }
}

export const initializePublisher = async (
  config: MessagePublisherConfig,
): Promise<MessagePublisher> => {
  const publisher = new MessagePublisher(config)
  await publisher.connect()
  return publisher
}

export const publishEvent = async (event: ServiceEvent): Promise<void> => {
  // TODO: Implement global publisher instance - for now just log
  logger.info(`📤 Publishing event: ${event.eventType}`)
}
