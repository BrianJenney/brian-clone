import { NextRequest, NextResponse } from "next/server";
import {
  DeleteRequestSchema,
  DeleteResponse,
  ContentType,
} from "@/libs/schemas";
import { qdrantClient } from "@/libs/qdrant";
import { getCollectionName } from "@/libs/utils";

/**
 * DELETE /api/delete
 * Delete one or more points from a collection
 */
export async function DELETE(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = DeleteRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { ids, collection } = validationResult.data;
    const collectionName = getCollectionName(collection);

    // Delete points from Qdrant
    await qdrantClient.delete(collectionName, {
      wait: true,
      points: ids,
    });

    const response: DeleteResponse = {
      success: true,
      message: `Successfully deleted ${ids.length} point(s) from ${collectionName}`,
      deletedCount: ids.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting content:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
