import { Document, Schema, SchemaOptions, Model } from 'mongoose';

// Base document interface with common fields
export interface BaseDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

// Common schema options for all models
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      if ('isDeleted' in ret) delete ret.isDeleted;
      if ('deletedAt' in ret) delete ret.deletedAt;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
};

// Base schema fields that all models should have
export const baseSchemaFields = {
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
};

// Utility function to create schemas with base fields
export function createBaseSchema(
  schemaDefinition: Record<string, any>,
  options: SchemaOptions = {}
): Schema {
  const mergedOptions = { ...baseSchemaOptions, ...options };
  const mergedFields = { ...schemaDefinition, ...baseSchemaFields };
  
  const schema = new Schema(mergedFields, mergedOptions);
  
  // Add soft delete query helpers
  schema.pre(/^find/, function(this: any) {
    if (!this.getOptions().includeDeleted) {
      this.where({ isDeleted: { $ne: true } });
    }
  });
  
  // Add soft delete method
  schema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };
  
  // Add restore method
  schema.methods.restore = function() {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  };
  
  return schema;
}

// Interface for models with static methods
export interface BaseModel<T extends BaseDocument> extends Model<T> {
  findWithDeleted(): any;
  findDeleted(): any;
  findOneWithDeleted(filter: any): any;
}

// Add static methods to schema for soft delete functionality
export function addStaticMethods(schema: Schema) {
  schema.statics.findWithDeleted = function() {
    return this.find({}).setOptions({ includeDeleted: true });
  };
  
  schema.statics.findDeleted = function() {
    return this.find({ isDeleted: true }).setOptions({ includeDeleted: true });
  };
  
  schema.statics.findOneWithDeleted = function(filter: any) {
    return this.findOne(filter).setOptions({ includeDeleted: true });
  };
}

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  objectId: /^[0-9a-fA-F]{24}$/
};

// Common schema validators
export const validators = {
  required: (field: string) => ({
    required: [true, `${field} is required`]
  }),
  
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [validationPatterns.email, 'Please provide a valid email address']
  },
  
  url: {
    type: String,
    trim: true,
    match: [validationPatterns.url, 'Please provide a valid URL']
  },
  
  positiveNumber: (field: string) => ({
    type: Number,
    min: [0, `${field} must be a positive number`]
  }),
  
  enumValidator: (values: string[], field: string) => ({
    type: String,
    enum: {
      values,
      message: `{VALUE} is not a valid ${field}. Valid options are: ${values.join(', ')}`
    }
  })
};

// Interface for audit fields
export interface AuditableDocument extends BaseDocument {
  createdBy?: string;
  updatedBy?: string;
}

// Auditable schema fields
export const auditableSchemaFields = {
  createdBy: {
    type: String,
    ref: 'User'
  },
  updatedBy: {
    type: String,
    ref: 'User'
  }
};

// Add audit trail to schema
export function makeAuditable(schema: Schema) {
  schema.add(auditableSchemaFields);
  
  schema.pre('save', function(this: any) {
    if (this.isNew && !this.createdBy) {
      // Can be set by middleware with current user context
    }
    // Update updatedBy on every save
    if (!this.isNew) {
      // Can be set by middleware with current user context
    }
  });
}