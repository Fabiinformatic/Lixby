import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface AddCommentToFutureVisionData {
  comment_insert: Comment_Key;
}

export interface AddCommentToFutureVisionVariables {
  futureVisionId: UUIDString;
  content: string;
}

export interface Comment_Key {
  id: UUIDString;
  __typename?: 'Comment_Key';
}

export interface CreateFutureVisionData {
  futureVision_insert: FutureVision_Key;
}

export interface CreateFutureVisionVariables {
  title: string;
  content: string;
  isPublic: boolean;
  tags?: string[] | null;
  imageUrl?: string | null;
}

export interface FutureCircle_Key {
  id: UUIDString;
  __typename?: 'FutureCircle_Key';
}

export interface FutureVision_Key {
  id: UUIDString;
  __typename?: 'FutureVision_Key';
}

export interface ListPublicFutureVisionsData {
  futureVisions: ({
    id: UUIDString;
    title: string;
    content: string;
    imageUrl?: string | null;
    user: {
      username: string;
      avatarUrl?: string | null;
    };
      tags?: string[] | null;
      createdAt: TimestampString;
  } & FutureVision_Key)[];
}

export interface Membership_Key {
  userId: UUIDString;
  futureCircleId: UUIDString;
  __typename?: 'Membership_Key';
}

export interface MyFutureCirclesData {
  futureCircles: ({
    id: UUIDString;
    name: string;
    description: string;
    isPublic: boolean;
    createdAt: TimestampString;
    memberships_on_futureCircle: ({
      user: {
        username: string;
      };
        role: string;
    })[];
  } & FutureCircle_Key)[];
}

export interface Reaction_Key {
  id: UUIDString;
  __typename?: 'Reaction_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'ListPublicFutureVisions' Query. Allow users to execute without passing in DataConnect. */
export function listPublicFutureVisions(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublicFutureVisionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPublicFutureVisions' Query. Allow users to pass in custom DataConnect instances. */
export function listPublicFutureVisions(options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublicFutureVisionsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateFutureVision' Mutation. Allow users to execute without passing in DataConnect. */
export function createFutureVision(dc: DataConnect, vars: CreateFutureVisionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFutureVisionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateFutureVision' Mutation. Allow users to pass in custom DataConnect instances. */
export function createFutureVision(vars: CreateFutureVisionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateFutureVisionData>>;

/** Generated Node Admin SDK operation action function for the 'MyFutureCircles' Query. Allow users to execute without passing in DataConnect. */
export function myFutureCircles(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<MyFutureCirclesData>>;
/** Generated Node Admin SDK operation action function for the 'MyFutureCircles' Query. Allow users to pass in custom DataConnect instances. */
export function myFutureCircles(options?: OperationOptions): Promise<ExecuteOperationResponse<MyFutureCirclesData>>;

/** Generated Node Admin SDK operation action function for the 'AddCommentToFutureVision' Mutation. Allow users to execute without passing in DataConnect. */
export function addCommentToFutureVision(dc: DataConnect, vars: AddCommentToFutureVisionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddCommentToFutureVisionData>>;
/** Generated Node Admin SDK operation action function for the 'AddCommentToFutureVision' Mutation. Allow users to pass in custom DataConnect instances. */
export function addCommentToFutureVision(vars: AddCommentToFutureVisionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddCommentToFutureVisionData>>;

