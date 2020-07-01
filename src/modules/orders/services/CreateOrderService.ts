import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.', 400);
    }

    const productsId = products.map(product => ({ id: product.id }));

    const productsForPrice = await this.productsRepository.findAllById(
      productsId,
    );

    const productsToUpdateQuantity: IProduct[] = [];

    const productsToSave = products.map(product => {
      const productForPrice = productsForPrice.find(
        currentProductForPrice => currentProductForPrice.id === product.id,
      );

      if (!productForPrice) {
        throw new AppError('Invalid product.');
      }

      if (productForPrice.quantity < product.quantity) {
        throw new AppError('Invalid product quantity.');
      }

      productsToUpdateQuantity.push({
        id: product.id,
        quantity: productForPrice.quantity - product.quantity,
      });

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: productForPrice.price,
      };
    });

    await this.productsRepository.updateQuantity(productsToUpdateQuantity);

    const order = await this.ordersRepository.create({
      customer,
      products: productsToSave,
    });

    return order;
  }
}

export default CreateOrderService;
